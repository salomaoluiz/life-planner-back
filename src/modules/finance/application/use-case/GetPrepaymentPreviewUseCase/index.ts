import {
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  GetPrepaymentPreviewInput,
  GetPrepaymentPreviewSchema,
} from '@finance/application/dto/GetPrepaymentPreview';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import InstallmentPlanEntity from '@finance/domain/entity/InstallmentPlanEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  IFinanceCreditCardRepository,
  IFinanceInstallmentPlanRepository,
} from '@finance/domain/repository';
import {
  eligibleForPrepayment,
  EligibleInstallment,
} from '@finance/domain/service/InstallmentPlan';
import { isInvoiceAssignable } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface PrepaymentPreview {
  card: CreditCardEntity;
  eligible: EligibleInstallment[];
  plan: InstallmentPlanEntity;
  total: number;
}

// What a prepayment into `targetInvoiceMonth` would move (spec 032 FR 12, 13, 20). Also the checks the prepay itself repeats.
export class GetPrepaymentPreviewUseCase implements UseCaseWithParams<
  GetPrepaymentPreviewInput,
  PrepaymentPreview
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceInstallmentPlanRepository')
    private readonly installmentPlanRepository: IFinanceInstallmentPlanRepository,
  ) {}

  async execute(params: GetPrepaymentPreviewInput): Promise<PrepaymentPreview> {
    const input = validate(GetPrepaymentPreviewSchema, params);

    const plan = await this.installmentPlanRepository.findPlanById(input.id);

    if (!plan || !hasOwnerAccess(input.accessibleOwners, plan)) {
      throw new NotFoundException();
    }

    const card = await this.creditCardRepository.findCreditCardById(plan.creditCardId);

    if (!card) {
      throw new NotFoundException();
    }
    if (plan.prepayment) {
      throw new ConflictException('The plan already has a prepayment');
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });

    if (!isInvoiceAssignable(card, input.targetInvoiceMonth, data.payments, input.today)) {
      throw new UnprocessableEntityException('The target invoice is paid or not open yet');
    }

    const paidMonths = new Set(data.payments.map((payment) => payment.referenceMonth));
    const eligible = eligibleForPrepayment(
      plan.installments.map((row) => ({
        id: row.id,
        installmentNumber: row.installmentNumber as number,
        invoiceMonth: row.invoiceMonth as string,
        value: row.value,
      })),
      input.targetInvoiceMonth,
      paidMonths,
    );

    if (eligible.length === 0) {
      throw new UnprocessableEntityException('No installment to prepay');
    }

    return { card, eligible, plan, total: eligible.reduce((sum, row) => sum + row.value, 0) };
  }
}
