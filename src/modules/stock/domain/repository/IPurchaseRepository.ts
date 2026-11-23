import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import PurchaseEntity, { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

export interface ClosedPurchaseResult {
  lots: number;
  newItemIds: string[];
  purchase: PurchaseEntity;
  removedRows: number;
  updatedRows: number;
}
export interface ClosePurchaseParams {
  accountId?: string;
  clientId?: string;
  creditCardId?: string;
  date: Date;
  invoiceMonth?: string;
  marketId?: string;
  purchaseId: string;
  receiptTotalCents: number;
  rows: ClosingRowInput[];
  userId: string;
}
export interface ClosingRowInput {
  expirationDate?: Date;
  itemId?: string;
  lineTotalCents?: number;
  newItem?: { categoryId?: string; description: string; locationId?: string };
  quantity?: number;
  rowId: string;
  unitPriceCents?: number;
}
export interface FinanceReference {
  splitId?: string;
  transactionId?: string;
}
export type IPurchaseRepository = {
  // Atomic close: stock entries, the finance posting (`postFinance`, run inside the same transaction), price
  // history and list update. Any failure rolls everything back.
  close(
    params: ClosePurchaseParams,
    postFinance: (rows: PurchaseRowRecord[]) => Promise<FinanceReference>,
  ): Promise<ClosedPurchaseResult>;
  // `created: false` = the same id and user already existed (idempotent repeat).
  create(params: {
    currency: string;
    id: string;
    listId: string;
    marketId: string;
    owner: OwnerAccess['owner'];
    ownerId: string;
    purchaseDate: Date;
    userId: string;
  }): Promise<{ created: boolean; purchase: PurchaseEntity }>;
  // FR 41: removes the entries whose lot is untouched; the used ones are returned (`kept`).
  deleteClosed(
    purchaseId: string,
    userId: string,
    cancelFinance: (reference: FinanceReference) => Promise<void>,
  ): Promise<{ kept: PurchaseRowRecord[] }>;
  // Deletes markets, purchases, events and price history of the owner (account and family purge).
  deleteByOwner(access: OwnerAccess): Promise<void>;
  deleteRow(params: {
    clientId?: string;
    purchaseId: string;
    rowId: string;
    userId: string;
  }): Promise<boolean>;
  findById(id: string): Promise<PurchaseEntity | undefined>;
  findByList(listId: string, statuses: PurchaseStatuses[]): Promise<PurchaseEntity[]>;
  findClosedByList(
    listId: string,
    limit: number,
    cursor?: { closedAt: Date; id: string },
  ): Promise<PurchaseEntity[]>;
  findEventsAfter(listId: string, afterId: bigint, limit: number): Promise<PurchaseEventRecord[]>;
  findLastPrices(itemIds: string[], marketId: string): Promise<Map<string, LastPrice>>;
  findOtherCarts(listId: string, excludePurchaseId: string): Promise<OtherCart[]>;
  findPending(owners: OwnerAccess[], now: Date): Promise<PendingPurchase[]>;
  findPriceHistory(
    itemId: string,
    limit: number,
    marketId?: string,
    cursor?: { date: Date; id: string },
  ): Promise<PriceHistoryPoint[]>;
  findRows(purchaseIds: string[]): Promise<PurchaseRowRecord[]>;
  // The item usage: which rows of a closed purchase have a lot with later movements (FR 39/41).
  findUsedRowIds(purchaseId: string): Promise<string[]>;
  // FR 8: an OPEN purchase without checked rows idle since `before` is discarded. Returns how many.
  discardIdle(owners: OwnerAccess[], before: Date): Promise<number>;
  mergeInto(sourceId: string, targetId: string, userId: string): Promise<PurchaseEntity>;
  // FR 30: sets the lock; `409` data when another closer holds a valid one is decided by the use case.
  setClosing(id: string, userId: null | string, now: Date): Promise<PurchaseEntity>;
  transition(
    id: string,
    to: PurchaseStatuses,
    userId: string,
    clientId?: string,
  ): Promise<PurchaseEntity>;
  updateClosed(
    params: {
      accountId?: string;
      creditCardId?: string;
      date?: Date;
      invoiceMonth?: string;
      marketId?: string;
      purchaseId: string;
      receiptTotalCents?: number;
      rowPrices?: { lineTotalCents?: number; rowId: string; unitPriceCents?: number }[];
      userId: string;
    },
    repostFinance: (rows: PurchaseRowRecord[]) => Promise<FinanceReference>,
  ): Promise<PurchaseWithRows>;
  upsertRow(params: UpsertPurchaseRowParams): Promise<UpsertPurchaseRowResult>;
};
export interface LastPrice {
  date: Date;
  unitPriceCents: number;
}
export interface OtherCart {
  listRowId: string;
  marketName: string;
  purchaseId: string;
  userName: string;
}
export interface PendingPurchase {
  cartTotalCents: number;
  checkedCount: number;
  id: string;
  lastActivityAt: Date;
  listId: string;
  listName: string;
  marketName: string;
  status: PurchaseStatuses;
}
export interface PriceHistoryPoint {
  date: Date;
  id: string;
  marketId: string;
  unitPriceCents: number;
}
export interface PurchaseEventRecord {
  id: bigint;
  payload: unknown;
  purchaseId: string;
  type: string;
}
export type PurchasePriceInputs = 'LINE' | 'UNIT';
export interface PurchaseRowRecord {
  checkedAt: Date;
  checkedBy?: { id: string; name: string };
  description?: string;
  entryMovementId?: string;
  expirationDate?: Date;
  id: string;
  purchaseId: string;
  state: PurchaseRowStates;
  unknownPrice: boolean;
  // The item of the row with what the views and the closing need.
  item?: {
    categoryId?: string;
    description: string;
    id: string;
    unit: StockUnits;
  };
  itemId?: string;
  lineTotalCents?: number;
  listRowId?: string;
  priceInput?: PurchasePriceInputs;
  quantity?: number;
  unit?: StockUnits;
  unitPriceCents?: number;
}
export type PurchaseRowStates = 'IN_CART' | 'NOT_FOUND';
export interface PurchaseWithRows {
  purchase: PurchaseEntity;
  rows: PurchaseRowRecord[];
}
export interface UpsertPurchaseRowParams {
  clientId?: string;
  description?: string;
  expirationDate?: Date | null;
  itemId?: string;
  lineTotalCents?: null | number;
  listRowId?: string;
  priceInput?: PurchasePriceInputs;
  purchaseId: string;
  quantity?: null | number;
  rowId: string;
  state?: PurchaseRowStates;
  unit?: StockUnits;
  unitPriceCents?: null | number;
  userId: string;
}
export interface UpsertPurchaseRowResult {
  // FR 18: the list row was taken by another purchase first; this row became an outside-the-list row.
  conflict?: { purchaseId: string; userName: string };
  convertedToOutside: boolean;
  row: PurchaseRowRecord;
}
