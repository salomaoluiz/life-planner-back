import {
  BadRequestException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  ResolveRefundLinkInput,
  ResolveRefundLinkSchema,
} from '@finance/application/dto/ResolveRefundLink';
import { TransactionType } from '@finance/domain/enum';
import {
  IFinanceInstallmentPlanRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface RefundLink {
  // Value of the linked purchase (plan: the current sum of its installments); undefined WHEN standalone.
  cap?: number;
  name?: string;
}

// The purchase or plan a refund points at: of the SAME card, one of the two at most (spec 032 FR 22, 24).
export class ResolveRefundLinkUseCase implements UseCaseWithParams<
  ResolveRefundLinkInput,
  RefundLink
> {
  constructor(
    @Inject('IFinanceInstallmentPlanRepository')
    private readonly installmentPlanRepository: IFinanceInstallmentPlanRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: ResolveRefundLinkInput): Promise<RefundLink> {
    const input = validate(ResolveRefundLinkSchema, params);

    if (input.refundedPlanId && input.refundedTransactionId) {
      throw new BadRequestException('Link a purchase or a plan, not both');
    }

    if (input.refundedTransactionId) {
      const purchase = await this.transactionRepository.findTransactionById(
        input.refundedTransactionId,
      );

      if (!purchase) {
        throw new NotFoundException('Purchase not found');
      }
      if (purchase.creditCardId !== input.creditCardId) {
        throw new UnprocessableEntityException('The purchase is on another card');
      }
      if (purchase.type !== TransactionType.EXPENSE || purchase.installmentPlanId) {
        throw new UnprocessableEntityException('Link the plan instead');
      }

      return { cap: purchase.value, name: purchase.description };
    }

    if (input.refundedPlanId) {
      const plan = await this.installmentPlanRepository.findPlanById(input.refundedPlanId);

      if (!plan) {
        throw new NotFoundException('Plan not found');
      }
      if (plan.creditCardId !== input.creditCardId) {
        throw new UnprocessableEntityException('The plan is on another card');
      }

      return {
        cap: plan.installments.reduce((sum, row) => sum + row.value, 0),
        name: plan.description,
      };
    }

    return {};
  }
}
