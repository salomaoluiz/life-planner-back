import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetClosePreviewInput, GetClosePreviewSchema } from '@stock/application/dto/Purchase';
import { loadReadablePurchase } from '@stock/application/service/PurchaseAccess';
import { missingWeightRows, toClosingRows } from '@stock/application/service/PurchaseClosing';
import { SuggestStockItemsUseCase } from '@stock/application/use-case/SuggestStockItemsUseCase';
import {
  IPurchaseRepository,
  IShoppingListRepository,
  IStockCatalogRepository,
  IStockRepository,
} from '@stock/domain/repository';
import { ClosingError, ClosingPlan, planClosing } from '@stock/domain/service/ClosingPlan';
import { suggestExpiration } from '@stock/domain/service/ExpirationSuggestion';

export interface ClosePreview {
  expirations: { rowId: string; suggestedDate: Date }[];
  financeError?: string;
  financeParts: ClosingPlan['parts'] | null;
  missingPrices: string[];
  needsDefaultFinanceCategory: boolean;
  newItems: {
    description: string;
    rowId: string;
    suggestion: { description: string; itemId: string } | null;
    unit?: string;
  }[];
  unknownWeight: string[];
}

// Spec 120 FR 27-31 and 35: reads and validates only, so the wizard can show every step before the close.
export class GetClosePreviewUseCase implements UseCaseWithParams<
  GetClosePreviewInput,
  ClosePreview
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject(SuggestStockItemsUseCase)
    private readonly suggestUseCase: SuggestStockItemsUseCase,
  ) {}

  async execute(params: GetClosePreviewInput): Promise<ClosePreview> {
    const input = validate(GetClosePreviewSchema, params);
    const purchase = await loadReadablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.id,
    );
    const [list, rows, categories] = await Promise.all([
      this.listRepository.findById(purchase.listId),
      this.purchaseRepository.findRows([purchase.id]),
      this.catalogRepository.findCategories({ owner: purchase.owner, ownerId: purchase.ownerId }),
    ]);
    const inCart = rows.filter((row) => row.state === 'IN_CART');
    const closing = toClosingRows(inCart, new Map(), categories);
    const textRows = inCart.filter((row) => !row.itemId);
    const newItems = await Promise.all(
      textRows.map(async (row) => {
        const [best] = await this.suggestUseCase.execute({
          accessibleOwners: input.accessibleOwners,
          owner: purchase.owner,
          ownerId: purchase.ownerId,
          q: row.description ?? '',
        });

        return {
          description: row.description ?? '',
          rowId: row.id,
          suggestion: best ? { description: best.description, itemId: best.id } : null,
          unit: row.unit,
        };
      }),
    );
    const expirations: ClosePreview['expirations'] = [];

    for (const row of inCart.filter((item) => item.itemId && !item.expirationDate)) {
      const item = await this.stockRepository.findById(row.itemId as string);
      const suggestedDate = item ? suggestExpiration(item.lots, purchase.purchaseDate) : undefined;

      if (suggestedDate) {
        expirations.push({ rowId: row.id, suggestedDate });
      }
    }

    let financeParts: ClosePreview['financeParts'] = null;
    let financeError: string | undefined;

    if (input.receiptTotalCents) {
      try {
        financeParts = planClosing({
          defaultFinanceCategoryId: list?.defaultFinanceCategoryId,
          receiptTotalCents: input.receiptTotalCents,
          rows: closing.rows,
        }).parts;
      } catch (error) {
        if (!(error instanceof ClosingError)) {
          throw error;
        }

        financeError = error.code;
      }
    }

    return {
      expirations,
      financeError,
      financeParts,
      missingPrices: closing.rows
        .filter((row) => row.lineTotalCents === undefined)
        .map((row) => row.id),
      needsDefaultFinanceCategory:
        !list?.defaultFinanceCategoryId && closing.rows.some((row) => !row.financeCategoryId),
      newItems,
      unknownWeight: missingWeightRows(inCart, new Map()),
    };
  }
}
