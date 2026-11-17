import { BadRequestException, Inject, Optional } from '@nestjs/common';

import { GetProjectionsInput, GetProjectionsSchema } from '@finance/application/dto/GetRecurrences';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { LoadFilterCategoriesUseCase } from '@finance/application/use-case/LoadFilterCategoriesUseCase';
import { ResolveSearchCategoryIdsUseCase } from '@finance/application/use-case/ResolveSearchCategoryIdsUseCase';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { narrowOwners, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { ProjectedOccurrence } from '@finance/domain/entity/ProjectedOccurrence';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import { TRANSFER_IN_SUMMARY } from '@finance/domain/entity/SystemCategory';
import { TransactionFilter } from '@finance/domain/entity/TransactionFilter';
import { RecurrenceStatus, RecurrenceUnit, TransactionType } from '@finance/domain/enum';
import {
  EXTERNAL_PROJECTION_SOURCE,
  IExternalProjectionSource,
  IFinanceAccountRepository,
  IFinanceCategoryRepository,
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
    @Inject(LoadFilterCategoriesUseCase)
    private readonly loadFilterCategoriesUseCase: LoadFilterCategoriesUseCase,
    @Inject(ResolveSearchCategoryIdsUseCase)
    private readonly resolveSearchCategoryIdsUseCase: ResolveSearchCategoryIdsUseCase,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
    @Optional()
    @Inject(EXTERNAL_PROJECTION_SOURCE)
    private readonly externalSource?: IExternalProjectionSource,
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
    const categories =
      input.preloaded?.categories ??
      (await this.loadFilterCategoriesUseCase.execute({
        accessibleOwners: input.accessibleOwners,
        filter,
      }));
    const preloaded = { categories };
    const categoryIds = filter.categoryIds?.length
      ? new Set(
          await this.expandCategoryIdsUseCase.execute({
            accessibleOwners: input.accessibleOwners,
            categoryIds: filter.categoryIds,
            preloaded,
          }),
        )
      : undefined;
    const searchCategoryIds = new Set(
      filter.q
        ? await this.resolveSearchCategoryIdsUseCase.execute({
            accessibleOwners: input.accessibleOwners,
            preloaded,
            q: filter.q,
          })
        : [],
    );
    const series = (
      await this.recurrenceRepository.findByOwners(owners, {
        status: RecurrenceStatus.ACTIVE,
        transfers: 'ALL',
      })
    ).filter((item) => matchesSeries(item, filter, categoryIds, searchCategoryIds));

    if (from > to) {
      return [];
    }

    const external = await this.findExternal(owners, from, to, input.today, filter, {
      categoryIds,
      searchCategoryIds,
    });

    if (series.length === 0) {
      return this.sortAndFilter(external, filter.currency);
    }

    const real = await this.recurrenceRepository.findFutureNumbers(
      series.map((item) => ({
        afterNumber: item.firstNumber - 1 + item.lastGeneratedNumber,
        recurrenceId: item.id,
      })),
    );
    const planned = series
      .map((item) => {
        const hidden = new Set([
          ...item.skippedNumbers,
          ...real.filter((row) => row.recurrenceId === item.id).map((row) => row.occurrenceNumber),
        ]);
        const scheduled = occurrencesBetween(item, from, to).filter(
          (occurrence) => !hidden.has(item.firstNumber - 1 + occurrence.k),
        );

        return { item, scheduled };
      })
      .filter(({ scheduled }) => scheduled.length > 0);
    // Spec 082: the cards of every series that projects, read once.
    const cardIds = [
      ...new Set(planned.flatMap(({ item }) => (item.creditCardId ? [item.creditCardId] : []))),
    ];
    const cards = new Map(
      (cardIds.length > 0 ? await this.creditCardRepository.findCreditCardsByIds(cardIds) : []).map(
        (card) => [card.id, card],
      ),
    );
    const result: ProjectedOccurrence[] = [];

    for (const { item, scheduled } of planned) {
      result.push(...(await this.project(item, scheduled, input.today, cards)));
    }

    // Spec 103: each projected item (each leg of a transfer) carries its own currency.
    return this.sortAndFilter([...result, ...external], filter.currency);
  }

  private sortAndFilter(items: ProjectedOccurrence[], currency?: string): ProjectedOccurrence[] {
    return items
      .filter((item) => !currency || item.currency === currency)
      .sort((a, b) => a.date.localeCompare(b.date) || a.recurrenceId.localeCompare(b.recurrenceId));
  }

  // Spec 115 FR 22: the incomes of investment series, as account income projections (never card ones, never tagged).
  private async findExternal(
    owners: OwnerAccess[],
    from: string,
    to: string,
    today: string,
    filter: TransactionFilter,
    resolved: { categoryIds?: Set<string>; searchCategoryIds: Set<string> },
  ): Promise<ProjectedOccurrence[]> {
    if (!this.externalSource || filter.tagIds?.length || filter.creditCardIds?.length) {
      return [];
    }

    const items = (await this.externalSource.findProjections({ from, owners, to, today })).filter(
      (item) =>
        (!resolved.categoryIds || resolved.categoryIds.has(item.categoryId)) &&
        (!filter.accountIds?.length || filter.accountIds.includes(item.accountId)) &&
        (!filter.q ||
          matchesTransactionQuery(
            {
              categoryId: item.categoryId,
              description: item.description,
              notes: null,
              valueCents: item.value,
            },
            filter.q,
            resolved.searchCategoryIds,
          )),
    );

    if (items.length === 0) {
      return [];
    }

    const accounts = new Map(
      (
        await this.accountRepository.findAccountsByIds([...new Set(items.map((i) => i.accountId))])
      ).map((account) => [account.id, account]),
    );
    const categories = new Map<
      string,
      Awaited<ReturnType<IFinanceCategoryRepository['findCategoryById']>>
    >();

    for (const id of new Set(items.map((item) => item.categoryId))) {
      categories.set(id, await this.categoryRepository.findCategoryById(id));
    }

    return items.flatMap((item) => {
      const account = accounts.get(item.accountId);
      const category = categories.get(item.categoryId);

      if (!account || !category) {
        return [];
      }

      return [
        {
          account: { icon: account.icon, id: account.id, name: account.name },
          category: {
            excludeFromTotals: false,
            icon: category.icon,
            iconColor: category.iconColor,
            id: category.id,
            name: category.name,
            systemKey: null,
          },
          creditCard: null,
          currency: item.currency,
          date: item.date,
          description: item.description,
          frequency: { interval: 1, unit: RecurrenceUnit.MONTH },
          investment: { assetId: item.assetId, seriesId: item.seriesId },
          invoiceListDate: null,
          invoiceMonth: null,
          notes: null,
          occurrenceCount: null,
          occurrenceNumber: item.number,
          owner: account.owner,
          ownerId: account.ownerId,
          projected: false,
          recurrenceId: item.seriesId,
          tags: [],
          type: TransactionType.INCOME,
          value: item.value,
        },
      ];
    });
  }

  // Spec 053: the same projections over up to 24 months, in windows of `MAX_PROJECTION_MONTHS`.
  async executeChunked(params: GetProjectionsInput): Promise<ProjectedOccurrence[]> {
    const { from, to } = validate(GetProjectionsSchema, params);
    const result: ProjectedOccurrence[] = [];
    // Spec 083: the categories are read once for all the windows.
    const categories =
      params.preloaded?.categories ??
      (await this.loadFilterCategoriesUseCase.execute({
        accessibleOwners: params.accessibleOwners,
        filter: params.filter,
      }));
    let start = from;

    do {
      const end = addInvoiceMonths(start, MAX_PROJECTION_MONTHS - 1);

      result.push(
        ...(await this.execute({
          ...params,
          from: start,
          preloaded: { ...params.preloaded, categories },
          to: to < end ? to : end,
        })),
      );
      start = addInvoiceMonths(start, MAX_PROJECTION_MONTHS);
    } while (start <= to);

    return result.sort(
      (a, b) => a.date.localeCompare(b.date) || a.recurrenceId.localeCompare(b.recurrenceId),
    );
  }

  // The preloaded card when the caller has the map (spec 082), else one read by id.
  private async cardOf(
    series: RecurrenceEntity,
    cards?: Map<string, CreditCardEntity>,
  ): Promise<CreditCardEntity | undefined> {
    if (!series.creditCardId) {
      return undefined;
    }

    return cards
      ? cards.get(series.creditCardId)
      : this.creditCardRepository.findCreditCardById(series.creditCardId);
  }

  // Spec 098 FR 8: the in side of a transfer series occurrence. Its amount is the series' (same currency) or unknown,
  // which projects as 0 so balances ignore it until the occurrence is paid with an amount in.
  private projectIn(series: RecurrenceEntity, out: ProjectedOccurrence): ProjectedOccurrence {
    return {
      ...out,
      account: series.toAccount,
      amountPending: series.amountIn === null,
      category: TRANSFER_IN_SUMMARY,
      currency: series.toCurrency ?? out.currency,
      transferSide: 'IN',
      type: TransactionType.INCOME,
      value: series.amountIn ?? 0,
    };
  }

  // Shared with `GetRecurrenceUseCase`: the card's CURRENT closing rule decides the invoice.
  async project(
    series: RecurrenceEntity,
    scheduled: ScheduledOccurrence[],
    today: string,
    cards?: Map<string, CreditCardEntity>,
  ): Promise<ProjectedOccurrence[]> {
    const card = await this.cardOf(series, cards);

    return scheduled.flatMap((occurrence) => {
      const invoiceMonth = card ? invoiceMonthOf(occurrence.date, card.closingDay) : null;
      const projection: ProjectedOccurrence = {
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
        projected: series.projected,
        recurrenceId: series.id,
        tags: series.tags,
        type: series.type,
        value: series.value,
      };

      return series.toAccountId === null
        ? [projection]
        : [
            { ...projection, amountPending: false, transferSide: 'OUT' as const },
            this.projectIn(series, projection),
          ];
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
