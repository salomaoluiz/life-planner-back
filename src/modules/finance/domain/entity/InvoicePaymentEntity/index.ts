import { InvoicePaymentMethod } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

interface IInvoicePaymentEntity {
  accountId: null | string;
  accountName: null | string;
  amount: number;
  createdAt: Date;
  creditCardId: string;
  id: string;
  invoiceMonth: string;
  method: InvoicePaymentMethod;
  owner: OwnerType;
  ownerId: string;
  paidOn: string;
  transactionId: null | string;
  updatedAt: Date;
}

class InvoicePaymentEntity {
  accountId: null | string;
  accountName: null | string;
  // Integer cents frozen when the invoice was paid.
  amount: number;
  createdAt: Date;
  creditCardId: string;
  id: string;
  // `YYYY-MM`
  invoiceMonth: string;
  method: InvoicePaymentMethod;
  owner: OwnerType;
  ownerId: string;
  // Calendar date `YYYY-MM-DD`.
  paidOn: string;
  // The INVOICE_PAYMENT transaction when paid from an account.
  transactionId: null | string;
  updatedAt: Date;

  constructor(params: IInvoicePaymentEntity) {
    this.accountId = params.accountId;
    this.accountName = params.accountName;
    this.amount = params.amount;
    this.createdAt = params.createdAt;
    this.creditCardId = params.creditCardId;
    this.id = params.id;
    this.invoiceMonth = params.invoiceMonth;
    this.method = params.method;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.paidOn = params.paidOn;
    this.transactionId = params.transactionId;
    this.updatedAt = params.updatedAt;
  }
}

export default InvoicePaymentEntity;
