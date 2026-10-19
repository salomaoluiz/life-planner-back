import {
  TransactionAccountSummary,
  TransactionCardSummary,
  TransactionCategorySummary,
} from '@finance/domain/entity/TransactionEntity';
import { RecurrenceFrequency, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// A future occurrence of a series, computed on read and never stored (spec 034 FR 8, FR 12).
export interface ProjectedOccurrence {
  account: null | TransactionAccountSummary;
  category: TransactionCategorySummary;
  creditCard: null | TransactionCardSummary;
  date: string;
  description: string;
  frequency: RecurrenceFrequency;
  // `YYYY-MM` of the invoice by the card's CURRENT closing rule; null for account series.
  invoiceMonth: null | string;
  occurrenceCount: null | number;
  occurrenceNumber: number;
  owner: OwnerType;
  ownerId: string;
  recurrenceId: string;
  type: TransactionType;
  value: number;
}
