import { ForbiddenException, Inject } from '@nestjs/common';

import {
  GetInvestmentsDashboardInput,
  GetInvestmentsDashboardSchema,
} from '@investment/application/dto/Dashboard';
import {
  DashboardAllocation,
  DashboardIncomeBucket,
  DashboardRankingRow,
  DashboardSeriesPoint,
  DashboardSummaryNumbers,
  dashboardTotals,
} from '@investment/application/service/DashboardTotals';
import { USD_BRL } from '@investment/application/service/QuoteContext';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { FixedIncomeData } from '@investment/domain/entity/FixedIncomeEntity';
import { PriceHistoryRow } from '@investment/domain/entity/QuoteEntity';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import {
  bucketsFor,
  bucketUnitFor,
  DashboardBucketUnit,
  endOfMonthOf,
} from '@investment/domain/service/DashboardBuckets';
import { lastBusinessDay, marketDateOf } from '@investment/domain/service/MarketDate';
import { AssetValuationInput } from '@investment/domain/service/PortfolioValuation';
import { marketOfClass } from '@investment/domain/service/QuoteResolver';
import {
  IIncomeRepository,
  IInvestmentRepository,
  IQuoteRepository,
} from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface InvestmentsDashboard {
  allocation: DashboardAllocation[];
  incomes: DashboardIncomeBucket[];
  period: { bucket: DashboardBucketUnit; from: string; to: string };
  ranking: DashboardRankingRow[];
  series: DashboardSeriesPoint[];
  summary: {
    historyStartsAt: null | string;
    staleQuotes: number;
  } & DashboardSummaryNumbers;
}

// Spec 110 FR 6-10: loads each data set once, then computes everything in memory (no per-point query).
export class GetInvestmentsDashboardUseCase implements UseCaseWithParams<
  GetInvestmentsDashboardInput,
  InvestmentsDashboard
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IQuoteRepository') private readonly quotes: IQuoteRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  async execute(params: GetInvestmentsDashboardInput): Promise<InvestmentsDashboard> {
    const input = validate(GetInvestmentsDashboardSchema, params);
    const requested = new Set(input.ownerIds);
    const owners = input.accessibleOwners.filter((access) => requested.has(access.ownerId));

    if (owners.length < requested.size) {
      throw new ForbiddenException('You cannot read one of the requested owners');
    }

    const details = await this.investment.findAssetDetailsByOwners(owners);
    const keys = symbolKeysOf(details);
    const needsFx = details.some((detail) => detail.currency === 'USD');
    const from = earliestDateOf(details, input.from);
    const incomeTo = input.to >= input.today ? endOfMonthOf(input.to) : input.to;
    const fixedIncomeIds = details
      .filter((detail) => detail.assetClass === InvestmentAssetClass.FIXED_INCOME)
      .map((detail) => detail.id);

    const [histories, fxHistory, fx, quotes, fixedIncome, incomes] = await Promise.all([
      keys.length > 0 ? this.quotes.findHistories(keys, from, input.to) : Promise.resolve([]),
      needsFx ? this.quotes.findFxHistory(USD_BRL, from, input.today) : Promise.resolve([]),
      needsFx ? this.quotes.findFx(USD_BRL) : Promise.resolve(undefined),
      keys.length > 0 ? this.quotes.findQuotes(keys) : Promise.resolve([]),
      fixedIncomeIds.length > 0
        ? this.investment.findFixedIncomeByAssetIds(fixedIncomeIds)
        : Promise.resolve(new Map<string, FixedIncomeData>()),
      this.incomes.findPeriodIncomes(owners, input.from, incomeTo),
    ]);
    const todayRate = fx?.rate ?? null;
    const buckets = bucketsFor(input.from, input.to);
    const assets = details.map((detail) =>
      toValuationInput(detail, histories, fxHistory, fixedIncome.get(detail.id) ?? null, todayRate, input.today),
    );
    const totals = dashboardTotals({
      assets,
      buckets,
      from: input.from,
      fx: { history: fxHistory, todayRate },
      incomes,
      to: input.to,
      today: input.today,
    });

    return {
      allocation: totals.allocation,
      incomes: totals.income,
      period: { bucket: bucketUnitFor(input.from, input.to), from: input.from, to: input.to },
      ranking: totals.ranking,
      series: totals.series,
      summary: {
        ...totals.summary,
        historyStartsAt: historyStartsAtOf(details, histories, input.to),
        staleQuotes: staleCountOf(details, quotes),
      },
    };
  }
}

function symbolKeysOf(details: AssetDetail[]): { market: QuoteMarket; ticker: string }[] {
  const keys = new Map<string, { market: QuoteMarket; ticker: string }>();

  for (const detail of details) {
    const market = marketOfClass(detail.assetClass);

    if (market && detail.ticker) {
      keys.set(`${market}:${detail.ticker}`, { market, ticker: detail.ticker });
    }
  }

  return [...keys.values()];
}
// Spec 110 FR 10: the range starts where the first operation needs a price, at the latest at the period start.
function earliestDateOf(details: AssetDetail[], fallback: string): string {
  const dates = details.flatMap((detail) => detail.operations.map((operation) => operation.date));

  return dates.length === 0 ? fallback : dates.reduce((min, date) => (date < min ? date : min));
}
function toValuationInput(
  detail: AssetDetail,
  histories: PriceHistoryRow[],
  fxHistory: { date: string; rate: string }[],
  fixedIncome: FixedIncomeData | null,
  todayRate: null | string,
  today: string,
): AssetValuationInput {
  const market = marketOfClass(detail.assetClass);

  return {
    asset: detail,
    closes:
      market && detail.ticker
        ? histories
            .filter((row) => row.market === market && row.ticker === detail.ticker)
            .map((row) => ({ date: row.date, price: row.close }))
        : [],
    fixedIncome,
    fxHistory: detail.currency === 'USD' ? fxHistory : [],
    operations: detail.operations,
    todayDate: today,
    todayRate,
    valuations: detail.valuations,
  };
}
// The latest date from which every listed asset already has stored closes (spec 110 FR 14).
function historyStartsAtOf(
  details: AssetDetail[],
  histories: PriceHistoryRow[],
  to: string,
): null | string {
  const starts = details
    .map((detail) => {
      const market = marketOfClass(detail.assetClass);

      if (!market || !detail.ticker) {
        return null;
      }

      const dates = histories
        .filter((row) => row.market === market && row.ticker === detail.ticker && row.date <= to)
        .map((row) => row.date)
        .sort();

      return dates[0] ?? null;
    })
    .filter((date): date is string => date !== null);

  return starts.length === 0 ? null : starts.reduce((max, date) => (date > max ? date : max));
}
// Spec 110 FR 26: stored quotes that did not update on the market's last business day (spec 104 rule).
function staleCountOf(
  details: AssetDetail[],
  quotes: { fetchedAt: Date; lastErrorAt: Date | null; market: QuoteMarket; quotedAt: Date; ticker: string }[],
): number {
  const now = new Date();

  return details.filter((detail) => {
    const market = marketOfClass(detail.assetClass);
    const quote = quotes.find((row) => row.market === market && row.ticker === detail.ticker);

    if (market === null || quote === undefined) {
      return false;
    }

    return (
      marketDateOf(quote.quotedAt, market) < lastBusinessDay(market, now) ||
      (quote.lastErrorAt !== null && quote.lastErrorAt > quote.fetchedAt)
    );
  }).length;
}
