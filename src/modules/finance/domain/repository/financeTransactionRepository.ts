import TransactionEntity, { TransactionType } from '@finance/domain/entity/TransactionEntity';

export type FinanceTransactionRepository = {
  createTransaction(params: CreateTransactionRepositoryParams): Promise<TransactionEntity>;
  deleteTransaction(params: DeleteTransactionRepositoryParams): Promise<void>;
  getTransactions(ownerIds: string[]): Promise<TransactionEntity[]>;
  updateTransaction(params: UpdateTransactionRepositoryParams): Promise<void>;
};

interface CreateTransactionRepositoryParams {
  category: string;
  date: string;
  description: string;
  ownerId: string;
  type: TransactionType;
  value: string;
}
interface DeleteTransactionRepositoryParams {
  id: string;
  ownerId: string;
}
interface UpdateTransactionRepositoryParams {
  category?: string;
  date?: string;
  description?: string;
  id: string;
  ownerId?: string;
  type?: TransactionType;
  value?: string;
}

export { CreateTransactionRepositoryParams, UpdateTransactionRepositoryParams };
