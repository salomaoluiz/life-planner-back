import {
  FinancialAccount,
  FinancialInvoicePayment,
  InvoicePaymentMethod,
  OwnerType,
} from '@db/client';
import { CurrencyCode } from '@finance/domain/enum/Currency';

export type FinancialInvoicePaymentWithAccount = {
  account: null | Pick<FinancialAccount, 'name'>;
} & FinancialInvoicePayment;
export interface IFinanceInvoicePaymentDatasource {
  exists(params: { owner: OwnerType; owner_id: string }): Promise<boolean>;
  findByCardAndMonth(
    creditCardId: string,
    invoiceMonth: string,
  ): Promise<FinancialInvoicePaymentWithAccount | null>;
  findByCardIds(creditCardIds: string[]): Promise<FinancialInvoicePaymentWithAccount[]>;
  pay(params: PayInvoiceDatasourceParams): Promise<FinancialInvoicePaymentWithAccount>;
  undo(creditCardId: string, invoiceMonth: string): Promise<void>;
}
export interface PayInvoiceDatasourceParams {
  account_id?: string;
  account_owner?: OwnerType;
  account_owner_id?: string;
  amount: number;
  category_id: string;
  credit_card_id: string;
  currency: CurrencyCode;
  description: string;
  invoice_month: string;
  method: InvoicePaymentMethod;
  owner: OwnerType;
  owner_id: string;
  paid_on: Date;
}
