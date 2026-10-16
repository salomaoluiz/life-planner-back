import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

interface IPrepaymentEntity {
  createdAt: Date;
  date: string;
  // Value of the discount row; 0 when the user got none.
  discount: number;
  discountTransactionId: null | string;
  id: string;
  installmentPlanId: string;
  originalMonths: Record<string, string>;
  owner: OwnerType;
  ownerId: string;
  targetInvoiceMonth: string;
  updatedAt: Date;
}

// One per installment plan (spec 032 FR 15): the moved installments keep their original invoice here for the undo.
class PrepaymentEntity {
  createdAt: Date;
  // Calendar date `YYYY-MM-DD`.
  date: string;
  discount: number;
  discountTransactionId: null | string;
  id: string;
  installmentPlanId: string;
  // `{ [transactionId]: 'YYYY-MM' }`
  originalMonths: Record<string, string>;
  owner: OwnerType;
  ownerId: string;
  // `YYYY-MM`
  targetInvoiceMonth: string;
  updatedAt: Date;

  constructor(params: IPrepaymentEntity) {
    this.createdAt = params.createdAt;
    this.date = params.date;
    this.discount = params.discount;
    this.discountTransactionId = params.discountTransactionId;
    this.id = params.id;
    this.installmentPlanId = params.installmentPlanId;
    this.originalMonths = params.originalMonths;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.targetInvoiceMonth = params.targetInvoiceMonth;
    this.updatedAt = params.updatedAt;
  }
}

export default PrepaymentEntity;
