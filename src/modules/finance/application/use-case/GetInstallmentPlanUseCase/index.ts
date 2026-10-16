import { Inject, NotFoundException } from '@nestjs/common';

import {
  GetInstallmentPlanInput,
  GetInstallmentPlanSchema,
} from '@finance/application/dto/GetInstallmentPlan';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import InstallmentPlanEntity from '@finance/domain/entity/InstallmentPlanEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { InvoiceStatus } from '@finance/domain/enum';
import {
  IFinanceCreditCardRepository,
  IFinanceInstallmentPlanRepository,
} from '@finance/domain/repository';
import { buildInvoiceFor } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface InstallmentPlanDetails {
  installments: InstallmentView[];
  // Only on create and update: the card ended above its limit (the write still succeeded).
  overLimit?: boolean;
  // `totalValue` is the SUM of the current installment values.
  plan: InstallmentPlanEntity;
}
export interface InstallmentView {
  id: string;
  installmentNumber: number;
  invoiceMonth: string;
  invoiceStatus: InvoiceStatus;
  // Moved into another invoice by the plan's prepayment.
  prepaid: boolean;
  value: number;
}

export class GetInstallmentPlanUseCase implements UseCaseWithParams<
  GetInstallmentPlanInput,
  InstallmentPlanDetails
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceInstallmentPlanRepository')
    private readonly installmentPlanRepository: IFinanceInstallmentPlanRepository,
  ) {}

  async execute(params: GetInstallmentPlanInput): Promise<InstallmentPlanDetails> {
    const input = validate(GetInstallmentPlanSchema, params);

    const plan = await this.installmentPlanRepository.findPlanById(input.id);

    if (!plan || !hasOwnerAccess(input.accessibleOwners, plan)) {
      throw new NotFoundException();
    }

    const card = await this.creditCardRepository.findCreditCardById(plan.creditCardId);

    if (!card) {
      throw new NotFoundException();
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });
    const installments = plan.installments.map((row) => ({
      id: row.id,
      installmentNumber: row.installmentNumber as number,
      invoiceMonth: row.invoiceMonth as string,
      invoiceStatus: buildInvoiceFor(
        card,
        row.invoiceMonth as string,
        data.totals,
        data.payments,
        input.today,
      ).status,
      prepaid: row.prepaymentId !== null,
      value: row.value,
    }));

    plan.totalValue = installments.reduce((total, row) => total + row.value, 0);

    return { installments, plan };
  }
}
