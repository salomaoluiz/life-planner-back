import { AccountStatus, CreditCardBrand, FinancialCreditCard, OwnerType } from '@db/client';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

export interface CreateCreditCardDatasourceParams {
  brand: CreditCardBrand;
  closing_day: number;
  color: string;
  due_day: number;
  last_digits?: string;
  limit: number;
  owner: OwnerType;
  owner_id: string;
  payment_day?: number;
  status: AccountStatus;
  title: string;
}
export interface ExistsCreditCardDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface IFinanceCreditCardDatasource {
  create(params: CreateCreditCardDatasourceParams): Promise<FinancialCreditCard>;
  delete(id: string): Promise<void>;
  exists(params: ExistsCreditCardDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<FinancialCreditCard | null>;
  findByOwners(owners: OwnerAccess[], status?: AccountStatus): Promise<FinancialCreditCard[]>;
  update(params: UpdateCreditCardDatasourceParams): Promise<FinancialCreditCard>;
}
export interface UpdateCreditCardDatasourceParams {
  brand?: CreditCardBrand;
  closing_day?: number;
  color?: string;
  due_day?: number;
  id: string;
  last_digits?: null | string;
  limit?: number;
  owner?: OwnerType;
  owner_id?: string;
  payment_day?: null | number;
  status?: AccountStatus;
  title?: string;
}
