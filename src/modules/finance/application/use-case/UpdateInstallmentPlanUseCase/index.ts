import {
  BadRequestException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  UpdateInstallmentPlanInput,
  UpdateInstallmentPlanSchema,
} from '@finance/application/dto/UpdateInstallmentPlan';
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
  isStructuralChange,
  splitInstallments,
} from '@finance/domain/service/InstallmentPlan';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// The "All" edit (spec 030 FR 15, 16). Only a REAL change of total, count, card or date recreates the rows;
// anything else is text-only and also renames paid installments.
export class UpdateInstallmentPlanUseCase implements UseCaseWithParams<
  UpdateInstallmentPlanInput,
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

  async execute(params: UpdateInstallmentPlanInput): Promise<InstallmentPlanDetails> {
    const input = validate(UpdateInstallmentPlanSchema, params);

    const plan = await this.installmentPlanRepository.findPlanById(input.id);

    if (!plan || !hasOwnerAccess(input.accessibleOwners, plan)) {
      throw new NotFoundException();
    }

    const total = plan.installments.reduce((sum, row) => sum + row.value, 0);
    const structural = isStructuralChange(
      { count: plan.installmentCount, creditCardId: plan.creditCardId, date: plan.date, total },
      input,
    );

    // After a prepayment the structural edits are blocked until it is undone (spec 032 FR 18).
    if (structural && plan.prepayment) {
      throw new UnprocessableEntityException('Undo the prepayment first');
    }

    const cardId = input.creditCardId ?? plan.creditCardId;
    const consistency = await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      // Only a change of card or a recreate may not use an archived card.
      blockArchivedAccount: structural,
      blockArchivedCategory: input.categoryId !== undefined && input.categoryId !== plan.categoryId,
      categoryId: input.categoryId ?? plan.categoryId,
      creditCardId: cardId,
      currency: plan.currency,
      owner: plan.owner,
      ownerId: plan.ownerId,
      type: TransactionType.EXPENSE,
    });
    // A credit card id always resolves to the card (or the consistency check threw).
    const card = consistency.card as CreditCardEntity;

    if (structural) {
      const count = input.installments ?? plan.installmentCount;
      const newTotal = input.value ?? total;

      if (newTotal < count) {
        throw new BadRequestException('The total needs at least one cent per installment');
      }

      const date = input.date ?? plan.date;

      await this.installmentPlanRepository.recreatePlan({
        categoryId: input.categoryId ?? plan.categoryId,
        creditCardId: card.id,
        date,
        description: input.description ?? plan.description,
        id: plan.id,
        months: installmentInvoiceMonths(invoiceMonthOf(date, card.closingDay), count),
        values: splitInstallments(newTotal, count),
      });
    } else {
      await this.installmentPlanRepository.updatePlanText({
        categoryId: input.categoryId,
        description: input.description,
        id: plan.id,
      });
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });
    const details = await this.getInstallmentPlanUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      id: plan.id,
      today: input.today,
    });

    return { ...details, overLimit: data.invoices.used > card.limit };
  }
}
