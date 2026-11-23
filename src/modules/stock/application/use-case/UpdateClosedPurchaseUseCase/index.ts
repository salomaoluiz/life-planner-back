import { ConflictException, Inject, NotFoundException } from '@nestjs/common';

import { validate } from '@shared/infra/validation';
import {
  UpdateClosedPurchaseInput,
  UpdateClosedPurchaseSchema,
} from '@stock/application/dto/Purchase';
import { loadWritablePurchase } from '@stock/application/service/PurchaseAccess';
import {
  ClosingFinancePosting,
  ClosingRowChoice,
  purchaseDescription,
  runClosingPlan,
  toClosingRows,
} from '@stock/application/service/PurchaseClosing';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';
import {
  FinanceReference,
  IMarketRepository,
  IPurchaseRepository,
  IShoppingListRepository,
  IStockCatalogRepository,
  PurchaseWithRows,
} from '@stock/domain/repository';

// Rebuilds the finance posting of a closed purchase (spec 120 FR 39); the API sends it to the finance module.
export type RepostClosingFinance = (
  posting: ClosingFinancePosting & FinanceReference,
) => Promise<FinanceReference>;

// Spec 120 FR 39: prices, receipt total, market, date and source of a closed purchase. Quantity, item and
// expiration edits (lot rule) are not offered yet.
export class UpdateClosedPurchaseUseCase {
  constructor(
    @Inject('IMarketRepository')
    private readonly marketRepository: IMarketRepository,
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(
    params: UpdateClosedPurchaseInput,
    repost: RepostClosingFinance,
  ): Promise<PurchaseWithRows> {
    const input = validate(UpdateClosedPurchaseSchema, params);
    const purchase = await loadWritablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.id,
    );

    if (purchase.status !== PurchaseStatuses.CLOSED) {
      throw new ConflictException({
        code: 'PURCHASE_NOT_CLOSED',
        message: 'Only a closed purchase can be edited this way',
      });
    }

    const market = await this.marketRepository.findById(input.marketId ?? purchase.marketId);

    if (!market || !hasOwnerAccess(input.accessibleOwners, market)) {
      throw new NotFoundException();
    }

    const [list, stored, categories] = await Promise.all([
      this.listRepository.findById(purchase.listId),
      this.purchaseRepository.findRows([purchase.id]),
      this.catalogRepository.findCategories({ owner: purchase.owner, ownerId: purchase.ownerId }),
    ]);
    const inCart = stored.filter((row) => row.state === 'IN_CART');
    const choices = new Map<string, ClosingRowChoice>(
      (input.rows ?? []).map((row) => [row.rowId, row]),
    );
    const { resolved, rows } = toClosingRows(inCart, choices, categories);
    const receiptTotalCents = input.receiptTotalCents ?? (purchase.receiptTotalCents as number);
    const plan = runClosingPlan({
      defaultFinanceCategoryId: list?.defaultFinanceCategoryId,
      receiptTotalCents,
      rows,
    });
    const filled = new Map(plan.rows.map((row) => [row.id, row.lineTotalCents]));
    const source =
      input.accountId === undefined && input.creditCardId === undefined
        ? { accountId: purchase.accountId, creditCardId: purchase.creditCardId }
        : { accountId: input.accountId, creditCardId: input.creditCardId };
    const date = input.date ?? purchase.purchaseDate;
    const invoiceMonth = input.invoiceMonth ?? purchase.invoiceMonth;

    return this.purchaseRepository.updateClosed(
      {
        ...source,
        date,
        invoiceMonth: source.creditCardId ? invoiceMonth : undefined,
        marketId: market.id,
        purchaseId: purchase.id,
        receiptTotalCents,
        rowPrices: inCart.map((row) => ({
          lineTotalCents: filled.get(row.id),
          rowId: row.id,
          unitPriceCents: resolved.get(row.id)?.unitPriceCents,
        })),
        userId: input.userId,
      },
      async () =>
        repost({
          ...source,
          currency: purchase.currency,
          date,
          description: purchaseDescription(market.name),
          invoiceMonth: source.creditCardId ? invoiceMonth : undefined,
          parts: plan.parts,
          splitId: purchase.splitId,
          total: receiptTotalCents,
          transactionId: purchase.transactionId,
        }),
    );
  }
}
