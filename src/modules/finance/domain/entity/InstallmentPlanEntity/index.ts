import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export interface PlanPrepaymentSummary {
  date: string;
  discount: number;
  id: string;
  targetInvoiceMonth: string;
}

interface IInstallmentPlanEntity {
  categoryId: string;
  createdAt: Date;
  creditCardId: string;
  date: string;
  description: string;
  id: string;
  installmentCount: number;
  installments: TransactionEntity[];
  owner: OwnerType;
  ownerId: string;
  prepayment?: null | PlanPrepaymentSummary;
  totalValue: number;
  updatedAt: Date;
}

class InstallmentPlanEntity {
  categoryId: string;
  createdAt: Date;
  creditCardId: string;
  // Purchase date `YYYY-MM-DD`.
  date: string;
  description: string;
  id: string;
  installmentCount: number;
  // One transaction per installment, ordered by `installmentNumber`.
  installments: TransactionEntity[];
  owner: OwnerType;
  ownerId: string;
  // The prepayment of the plan (spec 032), when there is one.
  prepayment: null | PlanPrepaymentSummary;
  // The total used for the last split; use cases report the SUM of the installments instead.
  totalValue: number;
  updatedAt: Date;

  constructor(params: IInstallmentPlanEntity) {
    this.categoryId = params.categoryId;
    this.createdAt = params.createdAt;
    this.creditCardId = params.creditCardId;
    this.date = params.date;
    this.description = params.description;
    this.id = params.id;
    this.installmentCount = params.installmentCount;
    this.installments = params.installments;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.prepayment = params.prepayment ?? null;
    this.totalValue = params.totalValue;
    this.updatedAt = params.updatedAt;
  }
}

export default InstallmentPlanEntity;
