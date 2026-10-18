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
export interface ExistsAccountDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface FindUnpaidSumsDatasourceParams {
  account_ids: string[];
  end_of_month: string;
}
export interface IFinanceAccountDatasource {
  create(params: CreateAccountDatasourceParams): Promise<FinancialAccount>;
  delete(id: string): Promise<void>;
  exists(params: ExistsAccountDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<FinancialAccount | null>;
  findByOwners(owners: OwnerAccess[]): Promise<FinancialAccount[]>;
  findUnpaidSums(params: FindUnpaidSumsDatasourceParams): Promise<UnpaidSumsRow[]>;
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
