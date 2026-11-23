import {
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { validate } from '@shared/infra/validation';
import { ClosePurchaseInput, ClosePurchaseSchema } from '@stock/application/dto/Purchase';
import { isClosingLocked, loadWritablePurchase } from '@stock/application/service/PurchaseAccess';
import {
  ClosingFinancePosting,
  ClosingRowChoice,
  missingWeightRows,
  noPriceLabel,
  purchaseDescription,
  runClosingPlan,
  toClosingRows,
} from '@stock/application/service/PurchaseClosing';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import PurchaseEntity, { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';
import {
  FinanceReference,
  IMarketRepository,
  IPurchaseRepository,
  IShoppingListRepository,
  IStockCatalogRepository,
  IStockRepository,
} from '@stock/domain/repository';

export interface ClosePurchaseOutput {
  lots: number;
  newItemIds: string[];
  purchase: PurchaseEntity;
  reference: FinanceReference;
  removedRows: number;
  updatedRows: number;
}
// Posts the closing in finance inside the closing transaction (the API aggregates the finance module).
export type PostClosingFinance = (posting: ClosingFinancePosting) => Promise<FinanceReference>;

// Spec 120 FR 27-38: validates the whole closing, then one transaction writes the stock entries, the finance
// posting, the price history and the list changes, or nothing.
export class ClosePurchaseUseCase {
  constructor(
    @Inject('IMarketRepository')
    private readonly marketRepository: IMarketRepository,
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(
    params: ClosePurchaseInput,
    postFinance: PostClosingFinance,
  ): Promise<ClosePurchaseOutput> {
    const input = validate(ClosePurchaseSchema, params);
    const purchase = await loadWritablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.id,
    );

    // FR 34: a retried close after a lost response answers the closed purchase, not 409.
    if (
      purchase.status === PurchaseStatuses.CLOSED &&
      purchase.closedBy === input.userId &&
      purchase.closedAt &&
      Date.now() - purchase.closedAt.getTime() < 10 * 60 * 1000
    ) {
      return {
        lots: 0,
        newItemIds: [],
        purchase,
        reference: { splitId: purchase.splitId, transactionId: purchase.transactionId },
        removedRows: 0,
        updatedRows: 0,
      };
    }

    if (![PurchaseStatuses.ENDED, PurchaseStatuses.OPEN].includes(purchase.status)) {
      throw new ConflictException({
        code: 'PURCHASE_NOT_OPEN',
        message: 'The purchase is not open',
      });
    }

    if (isClosingLocked(purchase, new Date()) && purchase.closingBy !== input.userId) {
      throw new ConflictException({
        by: { id: purchase.closingBy },
        code: 'PURCHASE_CLOSING',
        message: 'Someone else is closing this purchase',
      });
    }

    const list = await this.listRepository.findById(purchase.listId);

    if (!list) {
      throw new NotFoundException();
    }

    const stored = (await this.purchaseRepository.findRows([purchase.id])).filter(
      (row) => row.state === 'IN_CART',
    );
    const choices = new Map<string, ClosingRowChoice>();

    for (const choice of input.rows) {
      const row = stored.find((candidate) => candidate.id === choice.rowId);

      if (!row) {
        throw new UnprocessableEntityException('Unknown purchase row');
      }

      let categoryId = choice.newItem?.categoryId ?? row.item?.categoryId;

      if (choice.itemId) {
        const item = await this.stockRepository.findById(choice.itemId);

        if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
          throw new NotFoundException();
        }

        if (item.owner !== purchase.owner || item.ownerId !== purchase.ownerId) {
          throw new UnprocessableEntityException('The item belongs to another owner');
        }

        categoryId = item.categoryId;
      }

      choices.set(choice.rowId, { ...choice, categoryId });
    }

    const weightRows = missingWeightRows(stored, choices);

    if (weightRows.length > 0) {
      throw new UnprocessableEntityException({
        code: 'PURCHASE_WEIGHT_REQUIRED',
        message: 'Kilogram and liter rows need a quantity',
        rowIds: weightRows,
      });
    }

    const categories = await this.catalogRepository.findCategories({
      owner: purchase.owner,
      ownerId: purchase.ownerId,
    });
    const defaultFinanceCategoryId =
      input.defaultFinanceCategoryId ?? list.defaultFinanceCategoryId;
    const { resolved, rows } = toClosingRows(stored, choices, categories);
    const plan = runClosingPlan({
      defaultFinanceCategoryId,
      receiptTotalCents: input.receiptTotalCents,
      rows,
    });

    if (
      input.defaultFinanceCategoryId &&
      input.defaultFinanceCategoryId !== list.defaultFinanceCategoryId
    ) {
      await this.listRepository.update({
        defaultFinanceCategoryId: input.defaultFinanceCategoryId,
        id: list.id,
      });
    }

    const market = await this.marketRepository.findById(input.marketId ?? purchase.marketId);

    if (!market || !hasOwnerAccess(input.accessibleOwners, market)) {
      throw new NotFoundException();
    }

    const filled = new Map(plan.rows.map((row) => [row.id, row.lineTotalCents]));
    const result = await this.purchaseRepository.close(
      {
        accountId: input.accountId,
        clientId: input.clientId,
        creditCardId: input.creditCardId,
        date: input.date,
        invoiceMonth: input.invoiceMonth,
        marketId: market.id,
        purchaseId: purchase.id,
        receiptTotalCents: input.receiptTotalCents,
        rows: stored.map((row) => {
          const choice = choices.get(row.id);

          return {
            expirationDate: choice?.expirationDate,
            itemId: choice?.itemId,
            lineTotalCents: choice?.unknownPrice ? undefined : filled.get(row.id),
            newItem: choice?.newItem,
            quantity: resolved.get(row.id)?.quantity,
            rowId: row.id,
            unitPriceCents: choice?.unknownPrice ? undefined : resolved.get(row.id)?.unitPriceCents,
          };
        }),
        userId: input.userId,
      },
      async () =>
        postFinance({
          accountId: input.accountId,
          creditCardId: input.creditCardId,
          currency: purchase.currency,
          date: input.date,
          description: purchaseDescription(market.name, input.language),
          invoiceMonth: input.invoiceMonth,
          noPriceLabel: noPriceLabel(input.language),
          owner: purchase.owner,
          ownerId: purchase.ownerId,
          parts: plan.parts,
          total: input.receiptTotalCents,
        }),
    );
    const reference = {
      splitId: result.purchase.splitId,
      transactionId: result.purchase.transactionId,
    };

    return { ...result, reference };
  }
}
