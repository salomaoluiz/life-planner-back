import { Inject } from '@nestjs/common';

import {
  BLOCKER_LIST_LIMIT,
  FamilyBlockers,
  GetFamilyArchiveBlockersInput,
  GetFamilyArchiveBlockersSchema,
} from '@finance/application/dto/FamilyBlockers';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { RecurrenceStatus } from '@finance/domain/enum';
import {
  IFinanceCreditCardRepository,
  IFinanceInstallmentPlanRepository,
  IFinanceRecurrenceRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';

// Spec 042 FR 3: what blocks archiving a family. One query per kind; the caller (the API service) adds
// the family's pending invites. The caller must already have checked that the user owns the family.
export class GetFamilyArchiveBlockersUseCase implements UseCaseWithParams<
  GetFamilyArchiveBlockersInput,
  FamilyBlockers
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceInstallmentPlanRepository')
    private readonly planRepository: IFinanceInstallmentPlanRepository,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: GetFamilyArchiveBlockersInput): Promise<FamilyBlockers> {
    const input = validate(GetFamilyArchiveBlockersSchema, params);
    const owners = [{ owner: OwnerType.FAMILY, ownerId: input.familyId }];

    const [series, plans, cards, transactions] = await Promise.all([
      this.recurrenceRepository.findByOwners(owners, { status: RecurrenceStatus.ACTIVE }),
      this.planRepository.findPlansByOwners(owners),
      this.creditCardRepository.findCreditCards(owners),
      this.transactionRepository.findTransactions(owners),
    ]);

    const recurrences = series.map((item) => ({
      description: item.description,
      id: item.id,
      nextOccurrenceDate: item.nextOccurrenceDate,
    }));

    const installmentPlans = plans.flatMap(({ closingDay, plan }) => {
      const current = invoiceMonthOf(input.today, closingDay);
      const remaining = plan.installments.filter(
        (installment) => installment.invoiceMonth !== null && installment.invoiceMonth > current,
      ).length;

      return remaining > 0
        ? [{ description: plan.description, id: plan.id, remainingInstallments: remaining }]
        : [];
    });

    const cardInvoices = await this.computeCardInvoicesUseCase.execute({
      cards,
      today: input.today,
    });
    // Unpaid invoices up to the card's current (open) invoice month; upcoming ones are future.
    const invoices = cardInvoices.flatMap(({ card, invoices: calculated }) =>
      [...calculated.closedInvoices, calculated.openInvoice]
        .filter((invoice) => invoice.payment === null && invoice.amountDue > 0)
        .map((invoice) => ({
          amountDue: invoice.amountDue,
          creditCardId: card.id,
          creditCardName: card.title,
          month: invoice.referenceMonth,
        })),
    );

    // Future-dated unpaid rows are only planned: they do not block.
    const unpaidTransactions = transactions
      .filter((row) => row.paid === false && row.date <= input.today)
      .map((row) => ({
        date: row.date,
        description: row.description,
        id: row.id,
        value: row.value,
      }));

    return {
      counts: {
        installmentPlans: installmentPlans.length,
        invoices: invoices.length,
        recurrences: recurrences.length,
        unpaidTransactions: unpaidTransactions.length,
      },
      installmentPlans: installmentPlans.slice(0, BLOCKER_LIST_LIMIT),
      invoices: invoices.slice(0, BLOCKER_LIST_LIMIT),
      recurrences: recurrences.slice(0, BLOCKER_LIST_LIMIT),
      unpaidTransactions: unpaidTransactions.slice(0, BLOCKER_LIST_LIMIT),
    };
  }
}
