import { Inject, NotFoundException } from '@nestjs/common';

import {
  UndoInstallmentPrepaymentInput,
  UndoInstallmentPrepaymentSchema,
} from '@finance/application/dto/UndoInstallmentPrepayment';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  IFinanceInstallmentPlanRepository,
  IFinancePrepaymentRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Brings the moved installments back and removes the discount; the datasource answers 422 when the target invoice is paid (FR 17).
export class UndoInstallmentPrepaymentUseCase implements UseCaseWithParams<
  UndoInstallmentPrepaymentInput,
  void
> {
  constructor(
    @Inject('IFinanceInstallmentPlanRepository')
    private readonly installmentPlanRepository: IFinanceInstallmentPlanRepository,
    @Inject('IFinancePrepaymentRepository')
    private readonly prepaymentRepository: IFinancePrepaymentRepository,
  ) {}

  async execute(params: UndoInstallmentPrepaymentInput): Promise<void> {
    const input = validate(UndoInstallmentPrepaymentSchema, params);

    const plan = await this.installmentPlanRepository.findPlanById(input.id);

    if (!plan || !hasOwnerAccess(input.accessibleOwners, plan)) {
      throw new NotFoundException();
    }

    await this.prepaymentRepository.undoPrepayment(plan.id);
  }
}
