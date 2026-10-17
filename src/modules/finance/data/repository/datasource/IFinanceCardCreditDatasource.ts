import { InvoicePaymentMethod, OwnerType } from '@db/client';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';

export interface CardCreditAccountDatasourceParams {
  id: string;
  owner: OwnerType;
  owner_id: string;
}
export interface CreateEarlyPaymentDatasourceParams {
  account?: CardCreditAccountDatasourceParams;
  account_category_id: string;
  account_description: string;
  category_id: string;
  credit_card_id: string;
  date: Date;
  description: string;
  expected_net: number;
  invoice_month: string;
  method: InvoicePaymentMethod;
  owner: OwnerType;
  owner_id: string;
  value: number;
}
export interface CreateRefundDatasourceParams {
  category_id: string;
  credit_card_id: string;
  date: Date;
  description: string;
  invoice_month: string;
  max_linked?: number;
  owner: OwnerType;
  owner_id: string;
  refunded_plan_id?: string;
  refunded_transaction_id?: string;
  value: number;
}
export interface IFinanceCardCreditDatasource {
  countRefundsByPlanId(planId: string): Promise<number>;
  countRefundsByTransactionId(transactionId: string): Promise<number>;
  createEarlyPayment(
    params: CreateEarlyPaymentDatasourceParams,
  ): Promise<FinancialTransactionWithRelations>;
  createRefund(params: CreateRefundDatasourceParams): Promise<FinancialTransactionWithRelations>;
  deleteCredit(id: string): Promise<void>;
  updateEarlyPayment(
    params: UpdateEarlyPaymentDatasourceParams,
  ): Promise<FinancialTransactionWithRelations>;
  updateRefund(params: UpdateRefundDatasourceParams): Promise<FinancialTransactionWithRelations>;
}
export interface UpdateEarlyPaymentDatasourceParams {
  account?: CardCreditAccountDatasourceParams;
  account_description?: string;
  date?: Date;
  description?: string;
  expected_net?: number;
  id: string;
  invoice_month?: string;
  method?: InvoicePaymentMethod;
  value?: number;
}
export interface UpdateRefundDatasourceParams {
  date?: Date;
  description?: string;
  id: string;
  invoice_month?: string;
  max_linked?: number;
  refunded_plan_id?: null | string;
  refunded_transaction_id?: null | string;
  value?: number;
}
