import { FinancialInstallmentPlan, OwnerType } from '@db/client';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';

export interface CreateInstallmentPlanDatasourceParams {
  category_id: string;
  credit_card_id: string;
  date: Date;
  description: string;
  owner: OwnerType;
  owner_id: string;
  rows: InstallmentRowDatasourceParams[];
}
export type FinancialInstallmentPlanWithRows = {
  transactions: FinancialTransactionWithRelations[];
} & FinancialInstallmentPlan;
export interface IFinanceInstallmentPlanDatasource {
  // Plan id. Row k of `rows` is installment k + 1.
  create(params: CreateInstallmentPlanDatasourceParams): Promise<string>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<FinancialInstallmentPlanWithRows | null>;
  recreate(params: RecreateInstallmentPlanDatasourceParams): Promise<void>;
  updateFromNumber(params: UpdateInstallmentsFromDatasourceParams): Promise<void>;
  updateText(params: UpdateInstallmentPlanTextDatasourceParams): Promise<void>;
}
export interface InstallmentRowDatasourceParams {
  invoice_month: string;
  value: number;
}
export interface RecreateInstallmentPlanDatasourceParams {
  category_id: string;
  credit_card_id: string;
  date: Date;
  description: string;
  id: string;
  rows: InstallmentRowDatasourceParams[];
}
export interface UpdateInstallmentPlanTextDatasourceParams {
  category_id?: string;
  description?: string;
  id: string;
}
export interface UpdateInstallmentsFromDatasourceParams {
  category_id?: string;
  description?: string;
  from_number: number;
  plan_id: string;
  value?: number;
}
