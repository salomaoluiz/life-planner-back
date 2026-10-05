import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceTransactionRepository = {
  countByAccountId(accountId: string): Promise<number>;
  countByCategoryIds(categoryIds: string[]): Promise<number>;
  createTransaction(params: CreateTransactionRepositoryParams): Promise<TransactionEntity>;
  deleteTransaction(id: string): Promise<void>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findTransactionById(id: string): Promise<TransactionEntity | undefined>;
  // Sorted by `date` descending, then `createdAt` descending.
  findTransactions(owners: OwnerAccess[]): Promise<TransactionEntity[]>;
  updateTransaction(params: UpdateTransactionRepositoryParams): Promise<TransactionEntity>;
};

interface CreateTransactionRepositoryParams {
  accountId: string;
  categoryId: string;
  date: string;
  description: string;
  owner: OwnerType;
  ownerId: string;
  type: TransactionType;
  value: number;
}
interface UpdateTransactionRepositoryParams {
  accountId?: string;
  categoryId?: string;
  date?: string;
  description?: string;
  id: string;
  owner?: OwnerType;
  ownerId?: string;
  type?: TransactionType;
  value?: number;
}

export { CreateTransactionRepositoryParams, UpdateTransactionRepositoryParams };
