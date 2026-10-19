import { AccountStatus, FinancialAccount, OwnerType } from '@db/client';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

export interface CreateAccountDatasourceParams {
  icon: string;
  initial_balance: number;
  ledger_balance: number;
  name: string;
  owner: OwnerType;
  owner_id: string;
  status: AccountStatus;
}
export interface DatedSumRow {
  account_id: string;
  amount: number;
  // `YYYY-MM-DD`
  date: string;
}
export interface ExistsAccountDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface FindPaidSumsDatasourceParams {
  account_ids: string[];
  from: string;
}
export interface FindUnpaidSumsDatasourceParams {
  account_ids: string[];
  end_of_month: string;
}
export interface FindUnpaidSumsUntilDatasourceParams {
  account_ids: string[];
  to: string;
}
export interface IFinanceAccountDatasource {
  create(params: CreateAccountDatasourceParams): Promise<FinancialAccount>;
  delete(id: string): Promise<void>;
  exists(params: ExistsAccountDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<FinancialAccount | null>;
  findByIds(ids: string[]): Promise<FinancialAccount[]>;
  findByOwners(owners: OwnerAccess[]): Promise<FinancialAccount[]>;
  findPaidSumsFrom(params: FindPaidSumsDatasourceParams): Promise<DatedSumRow[]>;
  findUnpaidSums(params: FindUnpaidSumsDatasourceParams): Promise<UnpaidSumsRow[]>;
  findUnpaidSumsUntil(params: FindUnpaidSumsUntilDatasourceParams): Promise<DatedSumRow[]>;
  update(params: UpdateAccountDatasourceParams): Promise<FinancialAccount>;
}
export interface UnpaidSumsRow {
  account_id: string;
  due_by_end_of_month: number;
}
export interface UpdateAccountDatasourceParams {
  icon?: string;
  id: string;
  name?: string;
  status?: AccountStatus;
}
