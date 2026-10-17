import { InvoicePaymentMethod, SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export interface TransactionAccountSummary {
  icon: string;
  id: string;
  name: string;
}
export interface TransactionCardSummary {
  color: string;
  id: string;
  lastDigits?: string;
  title: string;
}
export interface TransactionCategorySummary {
  // Balance adjustments (and later system categories) are skipped by income/expense totals.
  excludeFromTotals: boolean;
  icon: string;
  iconColor: string;
  id: string;
  name: string;
  // Set only for system categories.
  systemKey: null | SystemCategoryKey;
}

// The early payment (card row) an account debit row belongs to (spec 032 FR 35).
export interface TransactionEarlyPaymentSummary {
  creditCardId: string;
  id: string;
  invoiceMonth: string;
}

interface ITransactionEntity {
  account: null | TransactionAccountSummary;
  accountId: null | string;
  category: TransactionCategorySummary;
  categoryId: string;
  createdAt: Date;
  creditCard: null | TransactionCardSummary;
  creditCardId: null | string;
  date: string;
  description: string;
  earlyPayment?: null | TransactionEarlyPaymentSummary;
  id: string;
  // Total installments of the plan (join), the number of this row and the plan id; all null outside a plan.
  installmentCount: null | number;
  installmentNumber: null | number;
  installmentPlanId: null | string;
  // `YYYY-MM` of the invoice a card purchase belongs to; null for account rows.
  invoiceMonth: null | string;
  owner: OwnerType;
  ownerId: string;
  // Stored for account rows; derived from the invoice for card rows (spec 033).
  paid?: boolean;
  // Card credits (spec 032); all null/omitted on ordinary rows.
  paidFromAccountId?: null | string;
  paidFromAccountName?: null | string;
  paidFromTransactionId?: null | string;
  paymentMethod?: InvoicePaymentMethod | null;
  prepaymentId?: null | string;
  refundedName?: null | string;
  refundedPlanId?: null | string;
  refundedTransactionId?: null | string;
  type: TransactionType;
  updatedAt: Date;
  value: number;
}

class TransactionEntity {
  account: null | TransactionAccountSummary;
  accountId: null | string;
  category: TransactionCategorySummary;
  categoryId: string;
  createdAt: Date;
  creditCard: null | TransactionCardSummary;
  creditCardId: null | string;
  // Calendar date `YYYY-MM-DD` (no time, no timezone).
  date: string;
  description: string;
  // Set on the INVOICE_PAYMENT debit row of an early payment.
  earlyPayment: null | TransactionEarlyPaymentSummary;
  id: string;
  installmentCount: null | number;
  installmentNumber: null | number;
  installmentPlanId: null | string;
  // `YYYY-MM` of the invoice a card purchase belongs to; null for account rows.
  invoiceMonth: null | string;
  owner: OwnerType;
  ownerId: string;
  // Account rows: the stored status. Card rows: whether the invoice is paid (set by ResolveCardRowsPaidUseCase).
  paid: boolean;
  // Account of the debit row an early payment created, and its name.
  paidFromAccountId: null | string;
  paidFromAccountName: null | string;
  // The INVOICE_PAYMENT account row of an early payment paid from an account.
  paidFromTransactionId: null | string;
  paymentMethod: InvoicePaymentMethod | null;
  // Set on installments moved by a prepayment and on its discount row.
  prepaymentId: null | string;
  // Description of the refunded purchase or plan.
  refundedName: null | string;
  refundedPlanId: null | string;
  refundedTransactionId: null | string;
  type: TransactionType;
  updatedAt: Date;
  // Integer cents, always > 0; the sign comes from `type`.
  value: number;

  constructor(params: ITransactionEntity) {
    this.account = params.account;
    this.accountId = params.accountId;
    this.category = params.category;
    this.categoryId = params.categoryId;
    this.createdAt = params.createdAt;
    this.creditCard = params.creditCard;
    this.creditCardId = params.creditCardId;
    this.date = params.date;
    this.description = params.description;
    this.earlyPayment = params.earlyPayment ?? null;
    this.id = params.id;
    this.installmentCount = params.installmentCount;
    this.installmentNumber = params.installmentNumber;
    this.installmentPlanId = params.installmentPlanId;
    this.invoiceMonth = params.invoiceMonth;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.paid = params.paid ?? false;
    this.paidFromAccountId = params.paidFromAccountId ?? null;
    this.paidFromAccountName = params.paidFromAccountName ?? null;
    this.paidFromTransactionId = params.paidFromTransactionId ?? null;
    this.paymentMethod = params.paymentMethod ?? null;
    this.prepaymentId = params.prepaymentId ?? null;
    this.refundedName = params.refundedName ?? null;
    this.refundedPlanId = params.refundedPlanId ?? null;
    this.refundedTransactionId = params.refundedTransactionId ?? null;
    this.type = params.type;
    this.updatedAt = params.updatedAt;
    this.value = params.value;
  }
}

export default TransactionEntity;
