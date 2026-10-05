import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export interface TransactionAccountSummary {
  icon: string;
  id: string;
  name: string;
}
export interface TransactionCategorySummary {
  icon: string;
  iconColor: string;
  id: string;
  name: string;
}

interface ITransactionEntity {
  account: TransactionAccountSummary;
  accountId: string;
  category: TransactionCategorySummary;
  categoryId: string;
  createdAt: Date;
  date: string;
  description: string;
  id: string;
  owner: OwnerType;
  ownerId: string;
  type: TransactionType;
  updatedAt: Date;
  value: number;
}

class TransactionEntity {
  account: TransactionAccountSummary;
  accountId: string;
  category: TransactionCategorySummary;
  categoryId: string;
  createdAt: Date;
  // Calendar date `YYYY-MM-DD` (no time, no timezone).
  date: string;
  description: string;
  id: string;
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
    this.date = params.date;
    this.description = params.description;
    this.id = params.id;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.type = params.type;
    this.updatedAt = params.updatedAt;
    this.value = params.value;
  }
}

export default TransactionEntity;
