import { BadRequestException, Inject } from '@nestjs/common';

import { GetProjectionsInput, GetProjectionsSchema } from '@finance/application/dto/GetRecurrences';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { ProjectedOccurrence } from '@finance/domain/entity/ProjectedOccurrence';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import { RecurrenceStatus } from '@finance/domain/enum';
import {
  IFinanceCreditCardRepository,
  IFinanceRecurrenceRepository,
} from '@finance/domain/repository';
import { buildInvoiceFor, invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import {
  addDays,
  lastDayOfMonth,
  occurrencesBetween,
  ScheduledOccurrence,
} from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export const MAX_PROJECTION_MONTHS = 12;

export class GetProjectionsUseCase implements UseCaseWithParams<
  GetProjectionsInput,
  ProjectedOccurrence[]
> {
  constructor(
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: GetProjectionsInput): Promise<ProjectedOccurrence[]> {
    const input = validate(GetProjectionsSchema, params);

    if (input.to < input.from || monthsBetween(input.from, input.to) > MAX_PROJECTION_MONTHS) {
      throw new BadRequestException(`The range must be 1 to ${MAX_PROJECTION_MONTHS} months`);
    }

    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    // Only dates after the horizon are projected: everything up to it is (or will be) a real row.
    const horizon = lastDayOfMonth(input.today);
    const from = max(`${input.from}-01`, addDays(horizon, 1));
    const to = lastDayOfMonth(`${input.to}-01`);
    const series = await this.recurrenceRepository.findByOwners(owners, {
      status: RecurrenceStatus.ACTIVE,
    });

    if (series.length === 0 || from > to) {
      return [];
    }

    const real = await this.recurrenceRepository.findFutureNumbers(
      series.map((item) => item.id),
      horizon,
    );
    const result: ProjectedOccurrence[] = [];

    for (const item of series) {
      const hidden = new Set([
        ...item.skippedNumbers,
        ...real.filter((row) => row.recurrenceId === item.id).map((row) => row.occurrenceNumber),
      ]);
      const scheduled = occurrencesBetween(item, from, to).filter(
        (occurrence) => !hidden.has(item.firstNumber - 1 + occurrence.k),
      );

      result.push(...(await this.project(item, scheduled, input.today)));
    }

    return result.sort(
      (a, b) => a.date.localeCompare(b.date) || a.recurrenceId.localeCompare(b.recurrenceId),
    );
  }

  // Shared with `GetRecurrenceUseCase`: the card's CURRENT closing rule decides the invoice.
  async project(
    series: RecurrenceEntity,
    scheduled: ScheduledOccurrence[],
    today: string,
  ): Promise<ProjectedOccurrence[]> {
    const card = series.creditCardId
      ? await this.creditCardRepository.findCreditCardById(series.creditCardId)
      : undefined;

    return scheduled.map((occurrence) => {
      const invoiceMonth = card ? invoiceMonthOf(occurrence.date, card.closingDay) : null;

      return {
        account: series.account,
        category: series.category,
        creditCard: series.creditCard,
        date: occurrence.date,
        description: series.description,
        frequency: series.frequency,
        invoiceListDate:
          card && invoiceMonth
            ? buildInvoiceFor(card, invoiceMonth, [], [], today).paymentDate
            : null,
        invoiceMonth,
        occurrenceCount: series.occurrenceCount,
        occurrenceNumber: series.firstNumber - 1 + occurrence.k,
        owner: series.owner,
        ownerId: series.ownerId,
        recurrenceId: series.id,
        type: series.type,
        value: series.value,
      };
    });
  }
}

function max(a: string, b: string): string {
  return a > b ? a : b;
}
// Inclusive count of calendar months from `YYYY-MM` to `YYYY-MM`.
function monthsBetween(from: string, to: string): number {
  return (
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    Number(to.slice(5)) -
    Number(from.slice(5)) +
    1
  );
}
