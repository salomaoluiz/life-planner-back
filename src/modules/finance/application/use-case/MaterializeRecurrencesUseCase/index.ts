import { Inject } from '@nestjs/common';

import {
  MaterializeRecurrencesInput,
  MaterializeRecurrencesSchema,
} from '@finance/application/dto/MaterializeRecurrences';
import { MaterializationGate } from '@finance/application/service/MaterializationGate';
import { narrowOwners, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  DueRecurrence,
  IFinanceCreditCardRepository,
  IFinanceInvoicePaymentRepository,
  IFinanceRecurrenceRepository,
  IFinanceTransferRepository,
} from '@finance/domain/repository';
import {
  lastDayOfMonth,
  planMaterialization,
  toOccurrenceRows,
} from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 034 FR 9: creates the missing real occurrences (up to the end of `today`'s month) of every active
// series of these owners. Idempotent and safe under concurrent reads (the datasource locks the series row).
export class MaterializeRecurrencesUseCase implements UseCaseWithParams<
  MaterializeRecurrencesInput,
  void
> {
  constructor(
    @Inject(MaterializationGate)
    private readonly materializationGate: MaterializationGate,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceInvoicePaymentRepository')
    private readonly invoicePaymentRepository: IFinanceInvoicePaymentRepository,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
    @Inject('IFinanceTransferRepository')
    private readonly transferRepository: IFinanceTransferRepository,
  ) {}

  async execute(params: MaterializeRecurrencesInput): Promise<void> {
    const input = validate(MaterializeRecurrencesSchema, params);
    // Safety net (spec 042 FR 10): never write rows for an archived family, even when it is requested explicitly.
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds).filter(
      (access) => !access.archived,
    );

    if (owners.length === 0) {
      return;
    }

    // Spec 081: skipped inside the owner TTL, shared between concurrent reads, reset by recurrence writes.
    await this.materializationGate.runOnce(
      owners.map((access) => access.ownerId),
      input.today,
      async () => this.run(owners, lastDayOfMonth(input.today)),
    );
  }

  private async materialize(
    series: DueRecurrence,
    horizon: string,
    payments: { creditCardId: string; invoiceMonth: string }[],
    closingDayOf: Map<string, number>,
  ): Promise<void> {
    const plan = planMaterialization({
      firstNumber: series.firstNumber,
      horizon,
      lastGeneratedNumber: series.lastGeneratedNumber,
      rule: series,
      skippedNumbers: series.skippedNumbers,
    });
    let card: Parameters<typeof toOccurrenceRows>[1];

    if (series.creditCardId) {
      const closingDay = closingDayOf.get(series.creditCardId);

      if (closingDay === undefined) {
        return;
      }

      card = {
        closingDay,
        paidMonths: new Set(
          payments
            .filter((payment) => payment.creditCardId === series.creditCardId)
            .map((payment) => payment.invoiceMonth),
        ),
      };
    }

    await this.recurrenceRepository.materialize({
      expectedLast: series.lastGeneratedNumber,
      id: series.id,
      lastGeneratedNumber: plan.lastGeneratedNumber,
      nextOccurrenceDate: plan.nextOccurrenceDate,
      rows: toOccurrenceRows(plan.occurrences, card),
      status: plan.status,
    });
  }

  // Spec 098 FR 8: each missing occurrence of a transfer series is an unpaid transfer; the amount in is the series'
  // (null for different currencies, so no in row exists until it is paid).
  private async materializeTransfer(series: DueRecurrence, horizon: string): Promise<void> {
    const plan = planMaterialization({
      firstNumber: series.firstNumber,
      horizon,
      lastGeneratedNumber: series.lastGeneratedNumber,
      rule: series,
      skippedNumbers: series.skippedNumbers,
    });

    await this.transferRepository.materializeTransferSeries({
      expectedLast: series.lastGeneratedNumber,
      id: series.id,
      lastGeneratedNumber: plan.lastGeneratedNumber,
      nextOccurrenceDate: plan.nextOccurrenceDate,
      occurrences: plan.occurrences.map((occurrence) => ({
        date: occurrence.date,
        number: occurrence.number,
      })),
      status: plan.status,
    });
  }

  private async run(owners: OwnerAccess[], horizon: string): Promise<void> {
    const due = await this.recurrenceRepository.findDue(owners, horizon);

    if (due.length === 0) {
      return;
    }

    const standard = due.filter((series) => series.toAccountId === null);
    const cardIds = [...new Set(standard.flatMap((series) => series.creditCardId ?? []))];
    const [payments, cards] =
      cardIds.length === 0
        ? [[], []]
        : await Promise.all([
            this.invoicePaymentRepository.findByCardIds(cardIds),
            this.creditCardRepository.findCreditCardsByIds(cardIds),
          ]);
    const closingDayOf = new Map(cards.map((card) => [card.id, card.closingDay]));

    for (const series of due) {
      if (series.toAccountId === null) {
        await this.materialize(series, horizon, payments, closingDayOf);
      } else {
        await this.materializeTransfer(series, horizon);
      }
    }
  }
}
