import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  DeleteInstallmentPlanInput,
  DeleteInstallmentPlanSchema,
} from '@finance/application/dto/DeleteInstallmentPlan';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  IFinanceCardCreditRepository,
  IFinanceInstallmentPlanRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Deletes the WHOLE plan; the datasource answers 422 when an installment is in a paid invoice (spec 030 FR 19, 20).
export class DeleteInstallmentPlanUseCase implements UseCaseWithParams<
  DeleteInstallmentPlanInput,
  void
> {
  constructor(
    @Inject('IFinanceCardCreditRepository')
    private readonly cardCreditRepository: IFinanceCardCreditRepository,
    @Inject('IFinanceInstallmentPlanRepository')
    private readonly installmentPlanRepository: IFinanceInstallmentPlanRepository,
  ) {}

  async execute(params: DeleteInstallmentPlanInput): Promise<void> {
    const input = validate(DeleteInstallmentPlanSchema, params);

    const plan = await this.installmentPlanRepository.findPlanById(input.id);

    if (!plan || !hasOwnerAccess(input.accessibleOwners, plan)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, plan);

    // A plan that was refunded goes away only after its refunds (spec 032 FR 26).
    if ((await this.cardCreditRepository.countRefundsByPlanId(plan.id)) > 0) {
      throw new UnprocessableEntityException('Delete its refunds first');
    }

    await this.installmentPlanRepository.deletePlan(input.id);
  }
}
