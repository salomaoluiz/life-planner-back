import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionType } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { totalOf, typeOf } from '@finance/domain/service/SplitRules';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

interface ISplitEntity {
  accountId: null | string;
  createdAt: Date;
  createdBy: string;
  creditCardId: null | string;
  currency: CurrencyCode;
  // Calendar date `YYYY-MM-DD`.
  date: string;
  description: string;
  id: string;
  invoiceMonth: null | string;
  notes: null | string;
  occurrenceNumber: null | number;
  owner: OwnerType;
  ownerId: string;
  paid: boolean | null;
  parts: TransactionEntity[];
  recurrenceId: null | string;
  updatedAt: Date;
}

// Spec 119: the header of a split; the parts are ordinary transaction rows (`splitId`), in the stored order.
class SplitEntity {
  accountId: null | string;
  createdAt: Date;
  createdBy: string;
  creditCardId: null | string;
  currency: CurrencyCode;
  date: string;
  description: string;
  id: string;
  invoiceMonth: null | string;
  notes: null | string;
  occurrenceNumber: null | number;
  owner: OwnerType;
  ownerId: string;
  paid: boolean | null;
  parts: TransactionEntity[];
  recurrenceId: null | string;
  // Magnitude of the net (FR 13) and its direction.
  total: number;
  type: TransactionType;
  updatedAt: Date;

  constructor(params: ISplitEntity) {
    this.accountId = params.accountId;
    this.createdAt = params.createdAt;
    this.createdBy = params.createdBy;
    this.creditCardId = params.creditCardId;
    this.currency = params.currency;
    this.date = params.date;
    this.description = params.description;
    this.id = params.id;
    this.invoiceMonth = params.invoiceMonth;
    this.notes = params.notes;
    this.occurrenceNumber = params.occurrenceNumber;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.paid = params.paid;
    this.parts = params.parts;
    this.recurrenceId = params.recurrenceId;
    this.total = totalOf(params.parts);
    this.type = typeOf(params.parts);
    this.updatedAt = params.updatedAt;
  }
}

export default SplitEntity;
