import { Inject } from '@nestjs/common';

import {
  MaterializeRecurrencesInput,
  MaterializeRecurrencesSchema,
} from '@finance/application/dto/MaterializeRecurrences';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import {
  IFinanceCreditCardRepository,
  IFinanceInvoicePaymentRepository,
  IFinanceRecurrenceRepository,
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
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceInvoicePaymentRepository')
    private readonly invoicePaymentRepository: IFinanceInvoicePaymentRepository,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: MaterializeRecurrencesInput): Promise<void> {
    const input = validate(MaterializeRecurrencesSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return;
    }

    const horizon = lastDayOfMonth(input.today);
    const due = await this.recurrenceRepository.findDue(owners, horizon);

    if (due.length === 0) {
      return;
    }

    const cardIds = [...new Set(due.flatMap((series) => series.creditCardId ?? []))];
    const payments = await this.invoicePaymentRepository.findByCardIds(cardIds);

    for (const series of due) {
      await this.materialize(series, horizon, payments);
    }
  }

  private async materialize(
    series: RecurrenceEntity,
    horizon: string,
    payments: { creditCardId: string; invoiceMonth: string }[],
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
      const found = await this.creditCardRepository.findCreditCardById(series.creditCardId);

      if (!found) {
        return;
      }

      card = {
        closingDay: found.closingDay,
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
}
