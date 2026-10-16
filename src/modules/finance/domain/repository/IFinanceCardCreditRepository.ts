import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { InvoicePaymentMethod } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Refunds and early payments: INCOME rows on a card (spec 032). Every write is ONE database transaction under the card lock.
export type IFinanceCardCreditRepository = {
  countRefundsByPlanId(planId: string): Promise<number>;
  countRefundsByTransactionId(transactionId: string): Promise<number>;
  // 409 WHEN the invoice no longer nets `expectedNet`; 422 WHEN the invoice has a payment record
  // or the early payments would exceed it. ACCOUNT also writes the INVOICE_PAYMENT debit row.
  createEarlyPayment(params: CreateEarlyPaymentRepositoryParams): Promise<TransactionEntity>;
  // 422 WHEN the invoice has a payment record or the linked refunds would pass `maxLinked`.
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
interface CreateRefundRepositoryParams {
  categoryId: string;
  creditCardId: string;
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
  CreateRefundRepositoryParams,
  UpdateEarlyPaymentRepositoryParams,
  UpdateRefundRepositoryParams,
};
