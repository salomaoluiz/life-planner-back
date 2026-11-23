import { Injectable } from '@nestjs/common';

import {
  ClosePurchaseApiInput,
  CreateMarketApiInput,
  StartPurchaseApiInput,
  UpdateClosedPurchaseApiInput,
  UpdateMarketApiInput,
  UpsertPurchaseRowApiInput,
} from '@api/stock/v1/dto/purchase.dto';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { CreateSplitUseCase } from '@finance/application/use-case/CreateSplitUseCase';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteSplitUseCase } from '@finance/application/use-case/DeleteSplitUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ClosingFinancePosting } from '@stock/application/service/PurchaseClosing';
import { PurchaseRowView, PurchaseView } from '@stock/application/service/PurchaseView';
import { ChangePurchaseStatusUseCase } from '@stock/application/use-case/ChangePurchaseStatusUseCase';
import { ClosePurchaseUseCase } from '@stock/application/use-case/ClosePurchaseUseCase';
import { ClosingLockUseCase } from '@stock/application/use-case/ClosingLockUseCase';
import { CreateMarketUseCase } from '@stock/application/use-case/CreateMarketUseCase';
import { DeleteClosedPurchaseUseCase } from '@stock/application/use-case/DeleteClosedPurchaseUseCase';
import { DeletePurchaseRowUseCase } from '@stock/application/use-case/DeletePurchaseRowUseCase';
import { GetClosePreviewUseCase } from '@stock/application/use-case/GetClosePreviewUseCase';
import { GetItemPricesUseCase } from '@stock/application/use-case/GetItemPricesUseCase';
import { GetListPurchasesUseCase } from '@stock/application/use-case/GetListPurchasesUseCase';
import { GetMarketsUseCase } from '@stock/application/use-case/GetMarketsUseCase';
import { GetPendingPurchasesUseCase } from '@stock/application/use-case/GetPendingPurchasesUseCase';
import { GetPurchaseEventsUseCase } from '@stock/application/use-case/GetPurchaseEventsUseCase';
import { GetPurchaseUseCase } from '@stock/application/use-case/GetPurchaseUseCase';
import { MergePurchaseUseCase } from '@stock/application/use-case/MergePurchaseUseCase';
import { StartPurchaseUseCase } from '@stock/application/use-case/StartPurchaseUseCase';
import { UpdateClosedPurchaseUseCase } from '@stock/application/use-case/UpdateClosedPurchaseUseCase';
import { UpdateMarketUseCase } from '@stock/application/use-case/UpdateMarketUseCase';
import { UpsertPurchaseRowUseCase } from '@stock/application/use-case/UpsertPurchaseRowUseCase';
import MarketEntity from '@stock/domain/entity/MarketEntity';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import PurchaseEntity from '@stock/domain/entity/PurchaseEntity';
import { FinanceReference } from '@stock/domain/repository';

export function decodeCursor(value?: string): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, string>;
  } catch {
    return undefined;
  }
}
export function encodeCursor(value: Record<string, string>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
export function toMarketOutput(market: MarketEntity) {
  return {
    id: market.id,
    name: market.name,
    neighborhood: nullable(market.neighborhood),
    owner: market.owner,
    ownerId: market.ownerId,
    status: market.status,
  };
}
export function toPurchaseHeader(purchase: PurchaseEntity) {
  return {
    accountId: nullable(purchase.accountId),
    closing:
      purchase.closingBy && purchase.closingAt
        ? { at: purchase.closingAt.toISOString(), by: purchase.closingBy }
        : null,
    creditCardId: nullable(purchase.creditCardId),
    currency: purchase.currency,
    id: purchase.id,
    invoiceMonth: nullable(purchase.invoiceMonth),
    lastActivityAt: purchase.lastActivityAt.toISOString(),
    listId: purchase.listId,
    marketId: purchase.marketId,
    purchaseDate: day(purchase.purchaseDate),
    receiptTotalCents: nullable(purchase.receiptTotalCents),
    splitId: nullable(purchase.splitId),
    startedBy: nullable(purchase.startedBy),
    status: purchase.status,
    transactionId: nullable(purchase.transactionId),
  };
}
export function toPurchaseRowOutput(row: PurchaseRowView) {
  return {
    checkedAt: row.checkedAt.toISOString(),
    checkedBy: nullable(row.checkedBy),
    description: row.description,
    expirationDate: row.expirationDate ? day(row.expirationDate) : null,
    id: row.id,
    itemId: nullable(row.itemId),
    lastPrice: row.lastPrice
      ? { date: day(row.lastPrice.date), unitPriceCents: row.lastPrice.unitPriceCents }
      : null,
    lineTotalCents: nullable(row.lineTotalCents),
    listRowId: nullable(row.listRowId),
    priceChangePercent: row.priceChangePercent,
    priceInput: nullable(row.priceInput),
    quantity: nullable(row.quantity),
    state: row.state,
    unit: nullable(row.unit),
    unitPriceCents: nullable(row.unitPriceCents),
    unknownPrice: row.unknownPrice,
  };
}
export function toPurchaseViewOutput(view: PurchaseView) {
  return {
    cart: view.cart,
    forecastCents: view.forecastCents,
    otherCarts: view.otherCarts,
    purchase: toPurchaseHeader(view.purchase),
    remaining: view.remaining,
    rows: view.rows.map((row) => toPurchaseRowOutput(row)),
  };
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}
function nullable<T>(value: T | undefined): null | T {
  return value ?? null;
}

@Injectable()
export class PurchaseService {
  constructor(
    private readonly changePurchaseStatusUseCase: ChangePurchaseStatusUseCase,
    private readonly closePurchaseUseCase: ClosePurchaseUseCase,
    private readonly closingLockUseCase: ClosingLockUseCase,
    private readonly createMarketUseCase: CreateMarketUseCase,
    private readonly createSplitUseCase: CreateSplitUseCase,
    private readonly createTransactionUseCase: CreateTransactionUseCase,
    private readonly deleteClosedPurchaseUseCase: DeleteClosedPurchaseUseCase,
    private readonly deletePurchaseRowUseCase: DeletePurchaseRowUseCase,
    private readonly deleteSplitUseCase: DeleteSplitUseCase,
    private readonly deleteTransactionUseCase: DeleteTransactionUseCase,
    private readonly getClosePreviewUseCase: GetClosePreviewUseCase,
    private readonly getItemPricesUseCase: GetItemPricesUseCase,
    private readonly getListPurchasesUseCase: GetListPurchasesUseCase,
    private readonly getMarketsUseCase: GetMarketsUseCase,
    private readonly getPendingPurchasesUseCase: GetPendingPurchasesUseCase,
    private readonly getPurchaseEventsUseCase: GetPurchaseEventsUseCase,
    private readonly getPurchaseUseCase: GetPurchaseUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly mergePurchaseUseCase: MergePurchaseUseCase,
    private readonly startPurchaseUseCase: StartPurchaseUseCase,
    private readonly updateClosedPurchaseUseCase: UpdateClosedPurchaseUseCase,
    private readonly updateMarketUseCase: UpdateMarketUseCase,
    private readonly upsertPurchaseRowUseCase: UpsertPurchaseRowUseCase,
  ) {}

  async changeStatus(
    userId: string,
    id: string,
    action: 'DISCARD' | 'END' | 'REOPEN',
    clientId?: string,
  ) {
    return toPurchaseHeader(
      await this.changePurchaseStatusUseCase.execute({
        accessibleOwners: await this.owners(userId),
        action,
        clientId,
        id,
        userId,
      }),
    );
  }

  async close(
    userId: string,
    id: string,
    input: ClosePurchaseApiInput,
    language?: string,
    key?: string,
  ) {
    const accessibleOwners = await this.owners(userId);
    const result = await this.closePurchaseUseCase.execute(
      {
        ...input,
        accessibleOwners,
        clientId: key,
        id,
        language: language as 'en-US' | 'pt-BR' | undefined,
        userId,
      },
      async (posting) => this.post(userId, accessibleOwners, posting),
    );

    return {
      list: { removedRows: result.removedRows, updatedRows: result.updatedRows },
      purchase: toPurchaseHeader(result.purchase),
      splitId: nullable(result.reference.splitId),
      stock: { lots: result.lots, newItems: result.newItemIds.length },
      transactionId: nullable(result.reference.transactionId),
    };
  }

  async closePreview(userId: string, id: string, receiptTotalCents?: number) {
    const preview = await this.getClosePreviewUseCase.execute({
      accessibleOwners: await this.owners(userId),
      id,
      receiptTotalCents,
    });

    return {
      expirations: preview.expirations.map((item) => ({
        rowId: item.rowId,
        suggestedDate: day(item.suggestedDate),
      })),
      financeError: nullable(preview.financeError),
      financeParts: preview.financeParts
        ? preview.financeParts.map((part) => ({
            categoryId: nullable(part.categoryId),
            kind: part.kind,
            valueCents: part.valueCents,
          }))
        : null,
      missingPrices: preview.missingPrices,
      needsDefaultFinanceCategory: preview.needsDefaultFinanceCategory,
      newItems: preview.newItems.map((item) => ({
        description: item.description,
        rowId: item.rowId,
        suggestion: item.suggestion,
        unit: nullable(item.unit),
      })),
      unknownWeight: preview.unknownWeight,
    };
  }

  async closingLock(userId: string, id: string, release: boolean) {
    const lock = await this.closingLockUseCase.execute({
      accessibleOwners: await this.owners(userId),
      id,
      release,
      userId,
    });

    return {
      closingAt: lock.closingAt ? lock.closingAt.toISOString() : null,
      closingBy: nullable(lock.closingBy),
    };
  }

  async createMarket(userId: string, input: CreateMarketApiInput) {
    return toMarketOutput(
      await this.createMarketUseCase.execute({
        ...input,
        accessibleOwners: await this.owners(userId),
      }),
    );
  }

  async deleteClosed(userId: string, id: string) {
    const accessibleOwners = await this.owners(userId);
    const result = await this.deleteClosedPurchaseUseCase.execute(
      { accessibleOwners, id, userId },
      async (reference) => {
        if (reference.splitId) {
          await this.deleteSplitUseCase.execute({
            accessibleOwners,
            fromStockPurchase: true,
            id: reference.splitId,
          });
        }
        if (reference.transactionId) {
          await this.deleteTransactionUseCase.execute({
            accessibleOwners,
            fromStockPurchase: true,
            id: reference.transactionId,
          });
        }
      },
    );

    return {
      keptRows: result.kept.map((row) => ({
        description: row.item?.description ?? row.description ?? '',
        rowId: row.id,
      })),
    };
  }

  async deleteRow(
    userId: string,
    purchaseId: string,
    rowId: string,
    clientId?: string,
  ): Promise<void> {
    await this.deletePurchaseRowUseCase.execute({
      accessibleOwners: await this.owners(userId),
      clientId,
      purchaseId,
      rowId,
      userId,
    });
  }

  async events(userId: string, listId: string, afterId: bigint) {
    return this.getPurchaseEventsUseCase.execute({
      accessibleOwners: await this.owners(userId),
      afterId,
      listId,
    });
  }

  async findMarkets(userId: string, query: { includeArchived: boolean; ownerId?: string }) {
    const markets = await this.getMarketsUseCase.execute({
      accessibleOwners: await this.owners(userId),
      includeArchived: query.includeArchived,
      ownerId: query.ownerId,
    });

    return { items: markets.map((market) => toMarketOutput(market)) };
  }

  async findPurchase(userId: string, id: string) {
    return toPurchaseViewOutput(
      await this.getPurchaseUseCase.execute({ accessibleOwners: await this.owners(userId), id }),
    );
  }

  async itemPrices(
    userId: string,
    itemId: string,
    query: { cursor?: string; limit?: number; marketId?: string },
  ) {
    const cursor = decodeCursor(query.cursor);
    const page = await this.getItemPricesUseCase.execute({
      accessibleOwners: await this.owners(userId),
      cursor: cursor ? { date: new Date(cursor.date), id: cursor.id } : undefined,
      itemId,
      limit: query.limit,
      marketId: query.marketId,
    });

    return {
      items: page.items.map((point) => ({
        date: day(point.date),
        id: point.id,
        marketId: point.marketId,
        unitPriceCents: point.unitPriceCents,
      })),
      nextCursor: page.nextCursor
        ? encodeCursor({ date: day(page.nextCursor.date), id: page.nextCursor.id })
        : null,
    };
  }

  async listPurchases(
    userId: string,
    listId: string,
    query: { cursor?: string; limit?: number; status: string[] },
  ) {
    const closed = query.status.includes('CLOSED');
    const cursor = decodeCursor(query.cursor);
    const result = await this.getListPurchasesUseCase.execute({
      accessibleOwners: await this.owners(userId),
      closed,
      cursor: cursor ? { closedAt: new Date(cursor.closedAt), id: cursor.id } : undefined,
      limit: query.limit,
      listId,
    });

    if (closed && result.closed) {
      const next = result.closed.nextCursor;

      return {
        items: result.closed.items.map((purchase) => toPurchaseHeader(purchase)),
        nextCursor: next
          ? encodeCursor({ closedAt: next.closedAt.toISOString(), id: next.id })
          : null,
      };
    }

    return {
      items: (result.open ?? []).map((view) => toPurchaseViewOutput(view)),
      nextCursor: null,
    };
  }

  async merge(userId: string, id: string, targetId: string) {
    return toPurchaseHeader(
      await this.mergePurchaseUseCase.execute({
        accessibleOwners: await this.owners(userId),
        id,
        targetId,
        userId,
      }),
    );
  }

  async pending(userId: string) {
    const items = await this.getPendingPurchasesUseCase.execute({
      accessibleOwners: await this.owners(userId),
      userId,
    });

    return {
      items: items.map((item) => ({
        cartTotalCents: item.cartTotalCents,
        checkedCount: item.checkedCount,
        id: item.id,
        lastActivityAt: item.lastActivityAt.toISOString(),
        listId: item.listId,
        listName: item.listName,
        marketName: item.marketName,
        status: item.status as 'ENDED' | 'OPEN',
      })),
    };
  }

  async removeRow(userId: string, purchaseId: string, rowId: string, clientId?: string) {
    return this.deleteRow(userId, purchaseId, rowId, clientId);
  }

  async start(userId: string, input: StartPurchaseApiInput) {
    const result = await this.startPurchaseUseCase.execute({
      ...input,
      accessibleOwners: await this.owners(userId),
      userId,
    });

    return { created: result.created, purchase: toPurchaseHeader(result.purchase) };
  }

  async updateClosed(userId: string, id: string, input: UpdateClosedPurchaseApiInput) {
    const accessibleOwners = await this.owners(userId);
    const result = await this.updateClosedPurchaseUseCase.execute(
      { ...input, accessibleOwners, id, userId },
      async (posting) => {
        // Rebuilds the posting: the old one goes, the new one is created in the same transaction (FR 39).
        if (posting.splitId) {
          await this.deleteSplitUseCase.execute({
            accessibleOwners,
            fromStockPurchase: true,
            id: posting.splitId,
          });
        }
        if (posting.transactionId) {
          await this.deleteTransactionUseCase.execute({
            accessibleOwners,
            fromStockPurchase: true,
            id: posting.transactionId,
          });
        }

        return this.post(userId, accessibleOwners, posting);
      },
    );

    return { purchase: toPurchaseHeader(result.purchase) };
  }

  async updateMarket(userId: string, id: string, input: UpdateMarketApiInput) {
    return toMarketOutput(
      await this.updateMarketUseCase.execute({
        ...input,
        accessibleOwners: await this.owners(userId),
        id,
      }),
    );
  }

  async upsertRow(
    userId: string,
    purchaseId: string,
    rowId: string,
    input: UpsertPurchaseRowApiInput,
    clientId?: string,
  ) {
    const result = await this.upsertPurchaseRowUseCase.execute({
      ...input,
      accessibleOwners: await this.owners(userId),
      clientId,
      purchaseId,
      rowId,
      userId,
    });

    return {
      conflict: nullable(result.conflict),
      convertedToOutside: result.convertedToOutside,
      row: toPurchaseRowOutput(result.row),
    };
  }

  // Spec 120 FR 33/35: ONE split (two or more parts) or one transaction (a single part), posted inside the
  // closing transaction (the repository opens it, every finance datasource joins it).
  private async post(
    userId: string,
    accessibleOwners: OwnerAccess[],
    posting: ClosingFinancePosting,
  ): Promise<FinanceReference> {
    const date = day(posting.date);
    const source = {
      accountId: posting.accountId,
      creditCardId: posting.creditCardId,
      invoiceMonth: posting.invoiceMonth,
    };
    const paid = posting.accountId ? true : undefined;

    if (posting.parts.length >= 2) {
      const split = await this.createSplitUseCase.execute({
        ...source,
        accessibleOwners,
        currency: posting.currency as 'BRL',
        date,
        description: posting.description,
        paid,
        parts: posting.parts.map((part) => ({
          ...(part.kind === 'ADJUSTMENT'
            ? {
                systemKey: SystemCategoryKey.SPLIT_ADJUSTMENT as SystemCategoryKey.SPLIT_ADJUSTMENT,
              }
            : { categoryId: part.categoryId }),
          description: part.kind === 'NO_PRICE' ? posting.noPriceLabel : undefined,
          type: TransactionType.EXPENSE,
          value: part.valueCents,
        })),
        requesterId: userId,
        today: date,
        total: posting.total,
      });

      return { splitId: split.id };
    }

    const created = await this.createTransactionUseCase.execute({
      ...source,
      accessibleOwners,
      categoryId: posting.parts[0].categoryId as string,
      currency: posting.currency as 'BRL',
      date,
      description: posting.description,
      owner: posting.owner,
      ownerId: posting.ownerId,
      paid,
      today: date,
      type: TransactionType.EXPENSE,
      value: posting.total,
    });

    return { transactionId: created.transaction.id };
  }

  // Resolved on every request: the caller plus every family they own or joined (spec 005, C1).
  private async owners(userId: string): Promise<OwnerAccess[]> {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);

    return [
      { owner: OwnerType.USER, ownerId: userId },
      ...families.map(({ archived, familyId }) => ({
        archived,
        owner: OwnerType.FAMILY,
        ownerId: familyId,
      })),
    ];
  }
}
