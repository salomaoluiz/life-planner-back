import {
  FinancialAccount,
  FinancialCategory,
  FinancialTransaction,
  OwnerType,
  TransactionType,
} from '@db/client';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

export interface CreateTransactionDatasourceParams {
  account_id: string;
  category_id: string;
  date: Date;
  description: string;
  owner: OwnerType;
  owner_id: string;
  type: TransactionType;
  value: number;
}
export interface ExistsTransactionDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export type FinancialTransactionWithRelations = {
  account: Pick<FinancialAccount, 'icon' | 'id' | 'name'>;
  category: Pick<FinancialCategory, 'icon_color' | 'icon' | 'id' | 'name'>;
} & FinancialTransaction;
export interface IFinanceTransactionDatasource {
  countByAccountId(accountId: string): Promise<number>;
  countByCategoryIds(categoryIds: string[]): Promise<number>;
  create(params: CreateTransactionDatasourceParams): Promise<FinancialTransactionWithRelations>;
  delete(id: string): Promise<void>;
  exists(params: ExistsTransactionDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<FinancialTransactionWithRelations | null>;
  findByOwners(owners: OwnerAccess[]): Promise<FinancialTransactionWithRelations[]>;
  update(params: UpdateTransactionDatasourceParams): Promise<FinancialTransactionWithRelations>;
}
export interface UpdateTransactionDatasourceParams {
  account_id?: string;
  category_id?: string;
  date?: Date;
  description?: string;
  id: string;
  owner?: OwnerType;
  owner_id?: string;
  type?: TransactionType;
  value?: number;
}
