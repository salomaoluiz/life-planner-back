import { FinancialInstallmentPlan, FinancialInstallmentPrepayment, OwnerType } from '@db/client';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { CurrencyCode } from '@finance/domain/enum/Currency';

export interface CreateInstallmentPlanDatasourceParams {
  category_id: string;
  credit_card_id: string;
  currency: CurrencyCode;
  date: Date;
  description: string;
  owner: OwnerType;
  owner_id: string;
  rows: InstallmentRowDatasourceParams[];
}
export type FinancialInstallmentPlanWithCard = {
  credit_card: { closing_day: number };
} & FinancialInstallmentPlanWithRows;
export type FinancialInstallmentPlanWithRows = {
  prepayment:
    | ({ discount_transaction: { value: number } | null } & FinancialInstallmentPrepayment)
    | null;
  transactions: FinancialTransactionWithRelations[];
} & FinancialInstallmentPlan;
export interface IFinanceInstallmentPlanDatasource {
  // Plan id. Row k of `rows` is installment k + 1.
  create(params: CreateInstallmentPlanDatasourceParams): Promise<string>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<FinancialInstallmentPlanWithRows | null>;
  // One query: the plans of these categories with their rows and the closing day of their card.
  findManyByCategoryIds(categoryIds: string[]): Promise<FinancialInstallmentPlanWithCard[]>;
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
