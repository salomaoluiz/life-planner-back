import { TransactionType } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type UpcomingKind = 'INVOICE' | 'PROJECTION' | 'TRANSACTION';

// An unpaid thing still to pay or receive (spec 062): a row, a whole card invoice or a recurrence projection.
export interface UpcomingItem {
  accountId: null | string;
  categoryId: null | string;
  creditCardId: null | string;
  currency: CurrencyCode;
  date: string;
  description: string;
  // Transaction id, `<cardId>:<YYYY-MM>` for an invoice or `<recurrenceId>:<occurrence>` for a projection.
  id: string;
  invoiceMonth: null | string;
  kind: UpcomingKind;
  occurrenceNumber: null | number;
  owner: OwnerType;
  ownerId: string;
  // Spec 096: the projected part of an invoice item; left out when there is none.
  projectedAmount?: number;
  purchaseCount: null | number;
  recurrenceId: null | string;
  type: TransactionType;
  valueCents: number;
}
