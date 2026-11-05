import { ForbiddenException, Inject, UnprocessableEntityException } from '@nestjs/common';

import {
  CreateInstallmentPlanInput,
  CreateInstallmentPlanSchema,
} from '@finance/application/dto/CreateInstallmentPlan';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
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
import {
  invoiceMonthOf,
  isOverLimit,
  isPurchaseInvoiceAllowed,
} from '@finance/domain/service/InvoiceCalculator';
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

    ensureOwnerWritable(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId });

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

    // Spec 095 FR 5: the first installment may sit on the previous, computed or next invoice of the date.
    // Paid months are refused by the datasource under the card lock (`Invoice is paid`).
    if (
      input.firstInvoiceMonth !== undefined &&
      !isPurchaseInvoiceAllowed(input.date, card.closingDay, input.firstInvoiceMonth)
    ) {
      throw new UnprocessableEntityException('Invoice is not available for this date');
    }

    const id = await this.installmentPlanRepository.createPlan({
      categoryId: input.categoryId,
      creditCardId: card.id,
      currency: card.currency,
      date: input.date,
      description: input.description,
      months: installmentInvoiceMonths(
        input.firstInvoiceMonth ?? invoiceMonthOf(input.date, card.closingDay),
        input.installments,
      ),
      notes: input.notes,
      owner: input.owner,
      ownerId: input.ownerId,
      tags: input.tags,
      values: splitInstallments(input.value, input.installments),
    });

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });
    const details = await this.getInstallmentPlanUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      card,
      id,
      invoiceData: data,
      today: input.today,
    });

    return { ...details, overLimit: isOverLimit(data.invoices, card.limit) };
  }
}
