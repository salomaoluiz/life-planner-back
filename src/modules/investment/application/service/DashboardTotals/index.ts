import { IncomeEntity } from '@investment/domain/entity/IncomeEntity';
import {
  InvestmentAssetClass,
  InvestmentIncomeType,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { DashboardBucket, endOfMonthOf } from '@investment/domain/service/DashboardBuckets';
import {
  AssetValuationInput,
  AssetSnapshot,
  convertCents,
  InvestmentValueKind,
  realizedInPeriod,
  snapshotAt,
} from '@investment/domain/service/PortfolioValuation';
import { Decimal8 } from '@shared/infra/decimal';

export interface DashboardAllocation {
  assetClass: InvestmentAssetClass;
  share: number;
  usd: null | {
    fxRate: string;
    resultFromAsset: number;
    resultFromFx: number;
    value: string;
  };
  value: number;
}
export interface DashboardIncomeBucket {
  byType: Record<InvestmentIncomeType, number>;
  date: string;
  planned: number;
  received: number;
}
export interface DashboardRankingRow {
  assetClass: InvestmentAssetClass;
  assetId: string;
  currency: string;
  name: string;
  openResult: number;
  openResultPercent: null | number;
  share: number;
  ticker: null | string;
  usdValue: null | string;
  value: number;
  valueKind: InvestmentValueKind;
}
export interface DashboardSeriesPoint {
  date: string;
  invested: null | number;
  marketValue: null | number;
}
export interface DashboardSummaryNumbers {
  assetsWithoutValue: number;
  currentValue: number;
  incomePlanned: number;
  incomeReceived: number;
  invested: number;
  openResult: number;
  openResultPercent: null | number;
  operationsWithoutFxRate: number;
  realizedResult: number;
  salesCount: number;
}
export interface DashboardFxSeries {
  history: { date: string; rate: string }[];
  todayRate: null | string;
}
export interface DashboardTotalsInput {
  assets: AssetValuationInput[];
  buckets: DashboardBucket[];
  fx: DashboardFxSeries;
  from: string;
  incomes: IncomeEntity[];
  to: string;
  today: string;
}

// Spec 110 FR 7-21: everything the overview shows, from the snapshots of each bucket's last day.
export function dashboardTotals(input: DashboardTotalsInput): {
  allocation: DashboardAllocation[];
  income: DashboardIncomeBucket[];
  ranking: DashboardRankingRow[];
  series: DashboardSeriesPoint[];
  summary: DashboardSummaryNumbers;
} {
  const series: DashboardSeriesPoint[] = [];
  const snapshotsOfDay = (date: string) =>
    input.assets
      .map((asset) => ({ asset, snapshot: snapshotAt(asset, date) }))
      .filter(
        (item): item is { asset: AssetValuationInput; snapshot: AssetSnapshot } =>
          item.snapshot !== null,
      );

  for (const bucket of input.buckets) {
    const snapshots = snapshotsOfDay(bucket.end);

    series.push(
      snapshots.length === 0
        ? { date: bucket.end, invested: null, marketValue: null }
        : {
            date: bucket.end,
            invested: sum(snapshots.map((item) => item.snapshot.costCents)),
            marketValue: sum(snapshots.map((item) => item.snapshot.valueCents)),
          },
    );
  }

  const end = snapshotsOfDay(input.to);
  const totalValue = sum(end.map((item) => item.snapshot.valueCents));
  const invested = sum(end.map((item) => item.snapshot.costCents));
  const openResult = totalValue - invested;

  return {
    allocation: allocationOf(end, totalValue, fxRateOn(input.fx, input.to, input.today)),
    income: incomeBuckets(input),
    ranking: end
      .map(({ asset, snapshot }) => rankingOf(asset, snapshot, totalValue))
      .sort(
        (a, b) =>
          b.value - a.value ||
          (a.ticker ?? a.name).localeCompare(b.ticker ?? b.name),
      ),
    series,
    summary: {
      assetsWithoutValue: end.filter((item) => item.snapshot.valueKind === 'COST').length,
      currentValue: totalValue,
      incomePlanned: incomeBuckets(input).reduce((total, bucket) => total + bucket.planned, 0),
      incomeReceived: incomeBuckets(input).reduce((total, bucket) => total + bucket.received, 0),
      invested,
      openResult,
      openResultPercent: invested === 0 ? null : Math.round((openResult / invested) * 10000) / 10000,
      operationsWithoutFxRate: input.assets.reduce(
        (total, asset) =>
          total +
          (asset.asset.currency === 'USD'
            ? asset.operations.filter(
                (operation) =>
                  operation.type === InvestmentOperationType.BUY && operation.fxRate === null,
              ).length
            : 0),
        0,
      ),
      realizedResult: sum(
        input.assets.map((asset) => realizedInPeriod(asset, input.from, input.to)),
      ),
      salesCount: input.assets.reduce(
        (total, asset) =>
          total +
          asset.operations.filter(
            (operation) =>
              operation.type === InvestmentOperationType.SELL &&
              operation.fractionOfOperationId === null &&
              operation.date >= input.from &&
              operation.date <= input.to,
          ).length,
        0,
      ),
    },
  };
}

export function fxRateOn(fx: DashboardFxSeries, date: string, today: string): null | string {
  if (date >= today) {
    return fx.todayRate ?? fx.history[fx.history.length - 1]?.rate ?? null;
  }

  const eligible = fx.history.filter((row) => row.date <= date);

  return eligible[eligible.length - 1]?.rate ?? fx.todayRate ?? null;
}

function allocationOf(
  end: { asset: AssetValuationInput; snapshot: AssetSnapshot }[],
  totalValue: number,
  fxRate: null | string,
): DashboardAllocation[] {
  const byClass = new Map<InvestmentAssetClass, DashboardAllocation>();

  for (const { asset, snapshot } of end) {
    const current = byClass.get(asset.asset.assetClass) ?? {
      assetClass: asset.asset.assetClass,
      share: 0,
      usd: null,
      value: 0,
    };

    current.value += snapshot.valueCents;
    if (snapshot.usd && fxRate) {
      current.usd = {
        fxRate,
        resultFromAsset: (current.usd?.resultFromAsset ?? 0) + snapshot.usd.resultFromAsset,
        resultFromFx: (current.usd?.resultFromFx ?? 0) + snapshot.usd.resultFromFx,
        value: fromCents(
          centsOf(current.usd?.value) + snapshot.usd.marketValueUsd,
        ),
      };
    }
    byClass.set(asset.asset.assetClass, current);
  }

  return [...byClass.values()]
    .filter((row) => row.value !== 0)
    .map((row) => ({ ...row, share: shareOf(row.value, totalValue) }))
    .sort((a, b) => b.value - a.value || a.assetClass.localeCompare(b.assetClass));
}
function incomeBuckets(input: DashboardTotalsInput): DashboardIncomeBucket[] {
  const buckets = input.buckets.map((bucket) => ({
    byType: emptyTypes(),
    date: bucket.end,
    planned: 0,
    received: 0,
  }));

  for (const income of input.incomes) {
    const index = indexOfIncome(input.buckets, income, input);

    if (index < 0) {
      continue;
    }

    const bucket = buckets[index];
    const rate = fxRateOn(input.fx, income.paymentDate, input.today);
    const amount =
      income.currency === 'USD'
        ? rate === null
          ? 0
          : convertCents(income.netAmount, rate)
        : income.netAmount;

    if (income.paid) {
      bucket.received += amount;
    } else {
      bucket.planned += amount;
    }
    bucket.byType[income.type] += 1;
  }

  return buckets;
}
function indexOfBucket(buckets: DashboardBucket[], date: string): number {
  return buckets.findIndex((bucket) => date >= bucket.start && date <= bucket.end);
}
// Spec 110 FR 21: the last bucket of a period that ends today also takes the planned incomes of the rest of its month.
function indexOfIncome(
  buckets: DashboardBucket[],
  income: IncomeEntity,
  input: DashboardTotalsInput,
): number {
  const index = indexOfBucket(buckets, income.paymentDate);

  if (index >= 0) {
    return index;
  }

  const last = buckets.length - 1;

  return !income.paid &&
    last >= 0 &&
    input.to >= input.today &&
    income.paymentDate > buckets[last].end &&
    income.paymentDate <= endOfMonthOf(buckets[last].end)
    ? last
    : -1;
}
function rankingOf(
  asset: AssetValuationInput,
  snapshot: AssetSnapshot,
  totalValue: number,
): DashboardRankingRow {
  return {
    assetClass: asset.asset.assetClass,
    assetId: asset.asset.id,
    currency: asset.asset.currency,
    name: asset.asset.name,
    openResult: snapshot.openResult,
    openResultPercent: snapshot.openResultPercent,
    share: shareOf(snapshot.valueCents, totalValue),
    ticker: asset.asset.ticker,
    usdValue: snapshot.usd ? fromCents(snapshot.usd.marketValueUsd) : null,
    value: snapshot.valueCents,
    valueKind: snapshot.valueKind,
  };
}
function emptyTypes(): Record<InvestmentIncomeType, number> {
  return {
    [InvestmentIncomeType.DIVIDEND]: 0,
    [InvestmentIncomeType.INTEREST]: 0,
    [InvestmentIncomeType.JCP]: 0,
    [InvestmentIncomeType.OTHER]: 0,
    [InvestmentIncomeType.YIELD]: 0,
  };
}
function shareOf(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 10000) / 10000;
}
const ONE = Decimal8.parse('1');
const CENTS_SCALE = 10n ** 6n;

// Cents as a decimal string of the currency ("462800" cents -> "4628").
function fromCents(cents: number): string {
  return Decimal8.fromScaled(BigInt(cents) * CENTS_SCALE).toString();
}
function centsOf(value: string | undefined): number {
  return value === undefined ? 0 : Decimal8.parse(value).mulToCents(ONE);
}
function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
