import { BadRequestException, Inject } from '@nestjs/common';

import { GetProjectionsInput, GetProjectionsSchema } from '@finance/application/dto/GetRecurrences';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { ResolveSearchCategoryIdsUseCase } from '@finance/application/use-case/ResolveSearchCategoryIdsUseCase';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { ProjectedOccurrence } from '@finance/domain/entity/ProjectedOccurrence';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import { TransactionFilter } from '@finance/domain/entity/TransactionFilter';
import { RecurrenceStatus } from '@finance/domain/enum';
import {
  IFinanceCreditCardRepository,
  IFinanceRecurrenceRepository,
} from '@finance/domain/repository';
import {
  addInvoiceMonths,
  buildInvoiceFor,
  invoiceMonthOf,
} from '@finance/domain/service/InvoiceCalculator';
import {
  addDays,
  lastDayOfMonth,
  occurrencesBetween,
  ScheduledOccurrence,
} from '@finance/domain/service/RecurrenceSchedule';
import { matchesTransactionQuery } from '@finance/domain/service/TransactionSearch';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export const MAX_PROJECTION_MONTHS = 12;

export class GetProjectionsUseCase implements UseCaseWithParams<
  GetProjectionsInput,
  ProjectedOccurrence[]
> {
  constructor(
    @Inject(ExpandCategoryIdsUseCase)
    private readonly expandCategoryIdsUseCase: ExpandCategoryIdsUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject(ResolveSearchCategoryIdsUseCase)
    private readonly resolveSearchCategoryIdsUseCase: ResolveSearchCategoryIdsUseCase,
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
    const filter = input.filter ?? {};
    const categoryIds = filter.categoryIds?.length
      ? new Set(
          await this.expandCategoryIdsUseCase.execute({
            accessibleOwners: input.accessibleOwners,
            categoryIds: filter.categoryIds,
          }),
        )
      : undefined;
    const searchCategoryIds = new Set(
      filter.q
        ? await this.resolveSearchCategoryIdsUseCase.execute({
            accessibleOwners: input.accessibleOwners,
            q: filter.q,
          })
        : [],
    );
    const series = (
      await this.recurrenceRepository.findByOwners(owners, { status: RecurrenceStatus.ACTIVE })
    ).filter((item) => matchesSeries(item, filter, categoryIds, searchCategoryIds));

    if (series.length === 0 || from > to) {
      return [];
    }

    const real = await this.recurrenceRepository.findFutureNumbers(
      series.map((item) => ({
        afterNumber: item.firstNumber - 1 + item.lastGeneratedNumber,
        recurrenceId: item.id,
      })),
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

  // Spec 053: the same projections over up to 24 months, in windows of `MAX_PROJECTION_MONTHS`.
  async executeChunked(params: GetProjectionsInput): Promise<ProjectedOccurrence[]> {
    const { from, to } = validate(GetProjectionsSchema, params);
    const result: ProjectedOccurrence[] = [];
    let start = from;

    do {
      const end = addInvoiceMonths(start, MAX_PROJECTION_MONTHS - 1);

      result.push(...(await this.execute({ ...params, from: start, to: to < end ? to : end })));
      start = addInvoiceMonths(start, MAX_PROJECTION_MONTHS);
    } while (start <= to);

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
        currency: series.currency,
        date: occurrence.date,
        description: series.description,
        frequency: series.frequency,
        invoiceListDate:
          card && invoiceMonth
            ? buildInvoiceFor(card, invoiceMonth, [], [], today).paymentDate
            : null,
        invoiceMonth,
        notes: series.notes,
        occurrenceCount: series.occurrenceCount,
        occurrenceNumber: series.firstNumber - 1 + occurrence.k,
        owner: series.owner,
        ownerId: series.ownerId,
        recurrenceId: series.id,
        tags: series.tags,
        type: series.type,
        value: series.value,
      };
    });
  }
}

// Spec 045 FR 9: projected rows follow the list filters (the paid filter is the app's: they are never paid).
function matchesSeries(
  item: RecurrenceEntity,
  filter: TransactionFilter,
  categoryIds: ReadonlySet<string> | undefined,
  searchCategoryIds: ReadonlySet<string>,
): boolean {
  const tagIds = filter.tagIds?.length ? new Set(filter.tagIds) : undefined;
  const hasSources = !!filter.accountIds?.length || !!filter.creditCardIds?.length;
  const inSources =
    (!!item.accountId && !!filter.accountIds?.includes(item.accountId)) ||
    (!!item.creditCardId && !!filter.creditCardIds?.includes(item.creditCardId));

  return (
    (!categoryIds || categoryIds.has(item.categoryId)) &&
    (!tagIds || (item.tags ?? []).some((tag) => tagIds.has(tag.id))) &&
    (!hasSources || inSources) &&
    (!filter.q ||
      matchesTransactionQuery(
        {
          categoryId: item.categoryId,
          description: item.description,
          notes: item.notes,
          valueCents: item.value,
        },
        filter.q,
        searchCategoryIds,
      ))
  );
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
