import PrepaymentEntity from '@finance/domain/entity/PrepaymentEntity';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinancePrepaymentRepository = {
  findByPlanId(planId: string): Promise<PrepaymentEntity | undefined>;
  // One database transaction under the card lock. The eligible rows are recomputed INSIDE it
  // (rows of the plan after the target whose invoice has no payment record): 422 when none,
  // 400 when the discount is above their total, 409 when the plan already has a prepayment.
  prepay(params: PrepayRepositoryParams): Promise<PrepaymentEntity>;
  // One database transaction: restores the original months, deletes the discount and the record.
  // 422 when the target (or an original) invoice has a payment record.
  undoPrepayment(planId: string): Promise<void>;
};

interface PrepayRepositoryParams {
  categoryId: string;
  creditCardId: string;
  date: string;
  discount: number;
  discountDescription: string;
  owner: OwnerType;
  ownerId: string;
  planId: string;
  targetInvoiceMonth: string;
}

export { PrepayRepositoryParams };
