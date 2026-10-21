import { InvoicePaymentMethod, OwnerType } from '@db/client';
import { PayInvoiceDatasourceParams } from '@finance/data/repository/datasource/IFinanceInvoicePaymentDatasource';
import {
  CreateTransactionDatasourceParams,
  FinancialTransactionWithRelations,
} from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { CurrencyCode } from '@finance/domain/enum/Currency';

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
  currency: CurrencyCode;
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
  currency: CurrencyCode;
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
// Spec 048: everything one CSV import writes besides plain account rows, in ONE database transaction.
export interface CreateImportRowsDatasourceParams {
  earlyPayments: CreateEarlyPaymentDatasourceParams[];
  payments: PayInvoiceDatasourceParams[];
  purchases: CreateTransactionDatasourceParams[];
  refunds: CreateRefundDatasourceParams[];
}
export interface IFinanceCardCreditDatasource {
  countRefundsByPlanId(planId: string): Promise<number>;
  countRefundsByTransactionId(transactionId: string): Promise<number>;
  createEarlyPayment(
    params: CreateEarlyPaymentDatasourceParams,
  ): Promise<FinancialTransactionWithRelations>;
  // Rows, refunds, early payments, then invoice payments (spec 048 FR 19); returns how many rows it wrote.
  createImportRows(params: CreateImportRowsDatasourceParams): Promise<number>;
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
