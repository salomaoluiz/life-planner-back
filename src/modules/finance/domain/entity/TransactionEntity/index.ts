import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export interface TransactionAccountSummary {
  icon: string;
  id: string;
  name: string;
}
export interface TransactionCardSummary {
  color: string;
  id: string;
  lastDigits?: string;
  title: string;
}
export interface TransactionCategorySummary {
  // Balance adjustments (and later system categories) are skipped by income/expense totals.
  excludeFromTotals: boolean;
  icon: string;
  iconColor: string;
  id: string;
  name: string;
  // Set only for system categories.
  systemKey: null | SystemCategoryKey;
}

interface ITransactionEntity {
  account: null | TransactionAccountSummary;
  accountId: null | string;
  category: TransactionCategorySummary;
  categoryId: string;
  createdAt: Date;
  creditCard: null | TransactionCardSummary;
  creditCardId: null | string;
  date: string;
  description: string;
  id: string;
  // `YYYY-MM` of the invoice a card purchase belongs to; null for account rows.
  invoiceMonth: null | string;
  owner: OwnerType;
  ownerId: string;
  type: TransactionType;
  updatedAt: Date;
  value: number;
}

class TransactionEntity {
  account: null | TransactionAccountSummary;
  accountId: null | string;
  category: TransactionCategorySummary;
  categoryId: string;
  createdAt: Date;
  creditCard: null | TransactionCardSummary;
  creditCardId: null | string;
  // Calendar date `YYYY-MM-DD` (no time, no timezone).
  date: string;
  description: string;
  id: string;
  // `YYYY-MM` of the invoice a card purchase belongs to; null for account rows.
  invoiceMonth: null | string;
  owner: OwnerType;
  ownerId: string;
  type: TransactionType;
  updatedAt: Date;
  // Integer cents, always > 0; the sign comes from `type`.
  value: number;

  constructor(params: ITransactionEntity) {
    this.account = params.account;
    this.accountId = params.accountId;
    this.category = params.category;
    this.categoryId = params.categoryId;
    this.createdAt = params.createdAt;
    this.creditCard = params.creditCard;
    this.creditCardId = params.creditCardId;
    this.date = params.date;
    this.description = params.description;
    this.id = params.id;
    this.invoiceMonth = params.invoiceMonth;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.type = params.type;
    this.updatedAt = params.updatedAt;
    this.value = params.value;
  }
}

export default TransactionEntity;
