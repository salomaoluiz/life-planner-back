import { AccountStatus, FinancialAccount, OwnerType } from '@db/client';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

export interface CreateAccountDatasourceParams {
  balance: number;
  icon: string;
  name: string;
  owner: OwnerType;
  owner_id: string;
  status: AccountStatus;
}
export interface ExistsAccountDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface IFinanceAccountDatasource {
  create(params: CreateAccountDatasourceParams): Promise<FinancialAccount>;
  delete(id: string): Promise<void>;
  exists(params: ExistsAccountDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<FinancialAccount | null>;
  findByOwners(owners: OwnerAccess[]): Promise<FinancialAccount[]>;
  update(params: UpdateAccountDatasourceParams): Promise<FinancialAccount>;
}
export interface UpdateAccountDatasourceParams {
  balance?: number;
  icon?: string;
  id: string;
  name?: string;
  status?: AccountStatus;
}
