import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { InvoicePaymentMethod } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { PayInvoiceRepositoryParams } from '@finance/domain/repository/IFinanceInvoicePaymentRepository';
import { CreateTransactionRepositoryParams } from '@finance/domain/repository/IFinanceTransactionRepository';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Refunds and early payments: INCOME rows on a card (spec 032). Every write is ONE database transaction under the card lock.
export type IFinanceCardCreditRepository = {
  countRefundsByPlanId(planId: string): Promise<number>;
  countRefundsByTransactionId(transactionId: string): Promise<number>;
  // 409 WHEN the invoice no longer nets `expectedNet`; 422 WHEN the invoice has a payment record
  // or the early payments would exceed it. ACCOUNT also writes the INVOICE_PAYMENT debit row.
  createEarlyPayment(params: CreateEarlyPaymentRepositoryParams): Promise<TransactionEntity>;
  // 422 WHEN the invoice has a payment record or the linked refunds would pass `maxLinked`.
  // Spec 048 FR 19: purchases, refunds, early payments and invoice payments of a CSV import in ONE database
  // transaction under the card locks; `expectedNet` and the refund cap are not checked (the import did it).
  createImportRows(params: CreateImportRowsRepositoryParams): Promise<number>;
  createRefund(params: CreateRefundRepositoryParams): Promise<TransactionEntity>;
  // Refund or early payment (and its debit row, ledger restored). 422 WHEN the invoice has a payment record.
  deleteCredit(id: string): Promise<void>;
  updateEarlyPayment(params: UpdateEarlyPaymentRepositoryParams): Promise<TransactionEntity>;
  updateRefund(params: UpdateRefundRepositoryParams): Promise<TransactionEntity>;
};

interface CardCreditAccount {
  id: string;
  owner: OwnerType;
  ownerId: string;
}
interface CreateEarlyPaymentRepositoryParams {
  account?: CardCreditAccount;
  accountCategoryId: string;
  accountDescription: string;
  categoryId: string;
  creditCardId: string;
  currency: CurrencyCode;
  date: string;
  description: string;
  // The invoice net the caller saw; compared again inside the lock.
  expectedNet: number;
  invoiceMonth: string;
  method: InvoicePaymentMethod;
  owner: OwnerType;
  ownerId: string;
  value: number;
}
interface CreateImportRowsRepositoryParams {
  earlyPayments: CreateEarlyPaymentRepositoryParams[];
  payments: PayInvoiceRepositoryParams[];
  purchases: CreateTransactionRepositoryParams[];
  refunds: CreateRefundRepositoryParams[];
}
interface CreateRefundRepositoryParams {
  categoryId: string;
  creditCardId: string;
  currency: CurrencyCode;
  date: string;
  description: string;
  invoiceMonth: string;
  // Cap of the linked purchase or plan; the sum of its refunds (this one included) may not pass it.
  maxLinked?: number;
  owner: OwnerType;
  ownerId: string;
  refundedPlanId?: string;
  refundedTransactionId?: string;
  value: number;
}
interface UpdateEarlyPaymentRepositoryParams {
  account?: CardCreditAccount;
  accountDescription?: string;
  date?: string;
  description?: string;
  expectedNet?: number;
  id: string;
  invoiceMonth?: string;
  method?: InvoicePaymentMethod;
  value?: number;
}
interface UpdateRefundRepositoryParams {
  date?: string;
  description?: string;
  id: string;
  invoiceMonth?: string;
  maxLinked?: number;
  refundedPlanId?: null | string;
  refundedTransactionId?: null | string;
  value?: number;
}

export {
  CardCreditAccount,
  CreateEarlyPaymentRepositoryParams,
  CreateImportRowsRepositoryParams,
  CreateRefundRepositoryParams,
  UpdateEarlyPaymentRepositoryParams,
  UpdateRefundRepositoryParams,
};
