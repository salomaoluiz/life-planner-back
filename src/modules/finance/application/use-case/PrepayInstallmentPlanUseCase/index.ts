import { BadRequestException, Inject, UnprocessableEntityException } from '@nestjs/common';

import {
  PrepayInstallmentPlanInput,
  PrepayInstallmentPlanSchema,
} from '@finance/application/dto/PrepayInstallmentPlan';
import {
  GetInstallmentPlanUseCase,
  InstallmentPlanDetails,
} from '@finance/application/use-case/GetInstallmentPlanUseCase';
import { GetPrepaymentPreviewUseCase } from '@finance/application/use-case/GetPrepaymentPreviewUseCase';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { AccountStatus, SystemCategoryKey } from '@finance/domain/enum';
import { IFinancePrepaymentRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Moves every remaining installment into one open or closed unpaid invoice with an optional discount (spec 032 FR 11-20).
export class PrepayInstallmentPlanUseCase implements UseCaseWithParams<
  PrepayInstallmentPlanInput,
  InstallmentPlanDetails
> {
  constructor(
    @Inject(GetInstallmentPlanUseCase)
    private readonly getInstallmentPlanUseCase: GetInstallmentPlanUseCase,
    @Inject(GetPrepaymentPreviewUseCase)
    private readonly getPrepaymentPreviewUseCase: GetPrepaymentPreviewUseCase,
    @Inject('IFinancePrepaymentRepository')
    private readonly prepaymentRepository: IFinancePrepaymentRepository,
  ) {}

  async execute(params: PrepayInstallmentPlanInput): Promise<InstallmentPlanDetails> {
    const input = validate(PrepayInstallmentPlanSchema, params);

    const { card, plan, total } = await this.getPrepaymentPreviewUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      id: input.id,
      targetInvoiceMonth: input.targetInvoiceMonth,
      today: input.today,
    });

    if (card.status === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException('Credit card is archived');
    }

    const discount = input.discount ?? 0;

    if (discount > total) {
      throw new BadRequestException('The discount cannot exceed the prepaid total');
    }

    await this.prepaymentRepository.prepay({
      categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT],
      creditCardId: card.id,
      date: input.date,
      discount,
      discountDescription: `Prepayment discount · ${plan.description}`,
      owner: card.owner,
      ownerId: card.ownerId,
      planId: plan.id,
      targetInvoiceMonth: input.targetInvoiceMonth,
    });

    return this.getInstallmentPlanUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      id: plan.id,
      today: input.today,
    });
  }
}
