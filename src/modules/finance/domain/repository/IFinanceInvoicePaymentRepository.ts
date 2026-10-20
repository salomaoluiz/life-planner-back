import InvoicePaymentEntity from '@finance/domain/entity/InvoicePaymentEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { InvoicePaymentMethod } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceInvoicePaymentRepository = {
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findByCardAndMonth(
    creditCardId: string,
    invoiceMonth: string,
  ): Promise<InvoicePaymentEntity | undefined>;
  findByCardIds(creditCardIds: string[]): Promise<InvoicePaymentEntity[]>;
  // One database transaction: payment record (+ the INVOICE_PAYMENT expense and the ledger when ACCOUNT).
  payInvoice(params: PayInvoiceRepositoryParams): Promise<InvoicePaymentEntity>;
  // One database transaction: deletes the record and its transaction (ledger restored).
  undoPayment(creditCardId: string, invoiceMonth: string): Promise<void>;
};

interface PayInvoiceRepositoryParams {
  accountId?: string;
  // Owner of the paying account (the payment transaction takes it); only for ACCOUNT.
  accountOwner?: { owner: OwnerType; ownerId: string };
  // The amount the caller saw; the write fails with 409 when the invoice no longer sums to it.
  amount: number;
  categoryId: string;
  creditCardId: string;
  currency: CurrencyCode;
  description: string;
  invoiceMonth: string;
  method: InvoicePaymentMethod;
  owner: OwnerType;
  ownerId: string;
  paidOn: string;
}

export { PayInvoiceRepositoryParams };
