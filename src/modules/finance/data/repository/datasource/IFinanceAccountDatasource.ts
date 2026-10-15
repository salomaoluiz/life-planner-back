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
export interface FindFutureSumsDatasourceParams {
  account_ids: string[];
  end_of_month: string;
  today: string;
}
export interface FutureSumsRow {
  account_id: string;
  after_end_of_month: number;
  after_today: number;
}
export interface IFinanceAccountDatasource {
  create(params: CreateAccountDatasourceParams): Promise<FinancialAccount>;
  delete(id: string): Promise<void>;
  exists(params: ExistsAccountDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<FinancialAccount | null>;
  findByOwners(owners: OwnerAccess[]): Promise<FinancialAccount[]>;
  findFutureSums(params: FindFutureSumsDatasourceParams): Promise<FutureSumsRow[]>;
  update(params: UpdateAccountDatasourceParams): Promise<FinancialAccount>;
}
export interface UpdateAccountDatasourceParams {
  icon?: string;
  id: string;
  name?: string;
  status?: AccountStatus;
}
