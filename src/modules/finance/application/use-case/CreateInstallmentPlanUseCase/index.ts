import { ForbiddenException, Inject } from '@nestjs/common';

import {
  CreateInstallmentPlanInput,
  CreateInstallmentPlanSchema,
} from '@finance/application/dto/CreateInstallmentPlan';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import {
  GetInstallmentPlanUseCase,
  InstallmentPlanDetails,
} from '@finance/application/use-case/GetInstallmentPlanUseCase';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { TransactionType } from '@finance/domain/enum';
import { IFinanceInstallmentPlanRepository } from '@finance/domain/repository';
import {
  installmentInvoiceMonths,
  splitInstallments,
} from '@finance/domain/service/InstallmentPlan';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class CreateInstallmentPlanUseCase implements UseCaseWithParams<
  CreateInstallmentPlanInput,
  InstallmentPlanDetails
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureTransactionConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject(GetInstallmentPlanUseCase)
    private readonly getInstallmentPlanUseCase: GetInstallmentPlanUseCase,
    @Inject('IFinanceInstallmentPlanRepository')
    private readonly installmentPlanRepository: IFinanceInstallmentPlanRepository,
  ) {}

  async execute(params: CreateInstallmentPlanInput): Promise<InstallmentPlanDetails> {
    const input = validate(CreateInstallmentPlanSchema, params);

    if (!hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    const consistency = await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      blockArchivedAccount: true,
      blockArchivedCategory: true,
      categoryId: input.categoryId,
      creditCardId: input.creditCardId,
      currency: input.currency,
      owner: input.owner,
      ownerId: input.ownerId,
      type: TransactionType.EXPENSE,
    });

    // A credit card id always resolves to the card (or the consistency check threw).
    const card = consistency.card as CreditCardEntity;

    const id = await this.installmentPlanRepository.createPlan({
      categoryId: input.categoryId,
      creditCardId: card.id,
      currency: card.currency,
      date: input.date,
      description: input.description,
      months: installmentInvoiceMonths(
        invoiceMonthOf(input.date, card.closingDay),
        input.installments,
      ),
      owner: input.owner,
      ownerId: input.ownerId,
      values: splitInstallments(input.value, input.installments),
    });

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });
    const details = await this.getInstallmentPlanUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      id,
      today: input.today,
    });

    return { ...details, overLimit: data.invoices.used > card.limit };
  }
}
