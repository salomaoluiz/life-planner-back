import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export enum PurchaseStatuses {
  CLOSED = 'CLOSED',
  DISCARDED = 'DISCARDED',
  ENDED = 'ENDED',
  OPEN = 'OPEN',
}

interface IPurchaseEntity {
  currency: string;
  id: string;
  lastActivityAt: Date;
  listId: string;
  marketId: string;
  owner: OwnerType;
  ownerId: string;
  purchaseDate: Date;
  startedAt: Date;
  status: PurchaseStatuses;
  // Optional properties
  accountId?: string;
  closedAt?: Date;
  closedBy?: string;
  closingAt?: Date;
  closingBy?: string;
  creditCardId?: string;
  endedAt?: Date;
  invoiceMonth?: string;
  receiptTotalCents?: number;
  splitId?: string;
  startedBy?: string;
  transactionId?: string;
}

// Spec 120 FR 1: OPEN → ENDED → CLOSED, or DISCARDED; only CLOSED writes stock and finance.
class PurchaseEntity {
  accountId?: string;
  closedAt?: Date;
  closedBy?: string;
  closingAt?: Date;
  closingBy?: string;
  creditCardId?: string;
  currency: string;
  endedAt?: Date;
  id: string;
  invoiceMonth?: string;
  lastActivityAt: Date;
  listId: string;
  marketId: string;
  owner: OwnerType;
  ownerId: string;
  purchaseDate: Date;
  receiptTotalCents?: number;
  splitId?: string;
  startedAt: Date;
  startedBy?: string;
  status: PurchaseStatuses;
  transactionId?: string;

  constructor(params: IPurchaseEntity) {
    this.accountId = params.accountId;
    this.closedAt = params.closedAt;
    this.closedBy = params.closedBy;
    this.closingAt = params.closingAt;
    this.closingBy = params.closingBy;
    this.creditCardId = params.creditCardId;
    this.currency = params.currency;
    this.endedAt = params.endedAt;
    this.id = params.id;
    this.invoiceMonth = params.invoiceMonth;
    this.lastActivityAt = params.lastActivityAt;
    this.listId = params.listId;
    this.marketId = params.marketId;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.purchaseDate = params.purchaseDate;
    this.receiptTotalCents = params.receiptTotalCents;
    this.splitId = params.splitId;
    this.startedAt = params.startedAt;
    this.startedBy = params.startedBy;
    this.status = params.status;
    this.transactionId = params.transactionId;
  }
}

export default PurchaseEntity;
