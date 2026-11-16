import { AssetListRow } from '@investment/domain/entity/AssetEntity';
import { PriceHistoryRow } from '@investment/domain/entity/QuoteEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import { InvestmentAssetClass, InvestmentIncomeType } from '@investment/domain/enum';
import { DashboardIncomeRow } from '@investment/domain/repository';
import {
  bucketEndOf,
  bucketEnds,
  bucketFor,
  DashboardBucket,
} from '@investment/domain/service/DashboardBuckets';
import { marketOfClass } from '@investment/domain/service/QuoteResolver';

import { toAssetView } from '../AssetView';
import {
  AssetValue,
  convertToBrl,
  FxCurve,
  rateAt,
  realizedInPeriod,
  ValuationInput,
  valueAssetAt,
  ValueKind,
} from '../PortfolioValuation';
import { QuoteContext, quoteKey } from '../QuoteContext';

export interface AllocationSlice {
  assetClass: InvestmentAssetClass;
  share: number;
  // Foreign currency assets of the class, at the rate of the period end (spec 110 FR 17).
  usd?: { fxRate: string; resultFromAsset: number; resultFromFx: number; value: string };
  value: number;
}
export interface DashboardData {
  closes: PriceHistoryRow[];
  context: QuoteContext;
  from: string;
  fx: FxCurve;
  incomes: DashboardIncomeRow[];
  rows: AssetListRow[];
  to: string;
  today: string;
  valuations: Map<string, ValuationEntity[]>;
}
export interface IncomeBucket {
  byType: Record<InvestmentIncomeType, number>;
  date: string;
  planned: number;
  received: number;
}
export interface InvestmentsDashboard {
  allocation: AllocationSlice[];
  incomes: IncomeBucket[];
  period: { bucket: DashboardBucket; from: string; to: string };
  ranking: RankingRow[];
  series: SeriesPoint[];
  summary: DashboardSummary;
}
export interface RankingRow {
  assetClass: InvestmentAssetClass;
  assetId: string;
  currency: string;
  name: string;
  openResult: number;
  openResultPercent: null | number;
  share: number;
  ticker: null | string;
  usdValue?: string;
  value: number;
  valueKind: ValueKind;
}
export interface SeriesPoint {
  date: string;
  invested: null | number;
  marketValue: null | number;
}

interface DashboardSummary {
  assetsWithoutValue: number;
  currentValue: number;
  historyStartsAt: null | string;
  incomePlanned: number;
  incomeReceived: number;
  invested: number;
  openResult: number;
  openResultPercent: null | number;
  operationsWithoutFxRate: number;
  realizedResult: number;
  salesCount: number;
  staleQuotes: number;
}
interface Position {
  input: ValuationInput;
  row: AssetListRow;
  value: AssetValue;
}

// Spec 110 FR 15: the order of the donut (stocks, FIIs, foreign, fixed income, unlisted).
const ALLOCATION_ORDER: InvestmentAssetClass[] = [
  InvestmentAssetClass.BR_STOCK,
  InvestmentAssetClass.BR_REIT,
  InvestmentAssetClass.FOREIGN_STOCK,
  InvestmentAssetClass.FIXED_INCOME,
  InvestmentAssetClass.PRIVATE,
];

// Spec 110 FR 6-22: everything the screen shows, computed in memory from data loaded once.
export function buildDashboard(data: DashboardData): InvestmentsDashboard {
  const inputs = data.rows.map((row) => toInput(row, data));
  const positions = inputs
    .map((input, index) => ({
      input,
      row: data.rows[index] as AssetListRow,
      value: valueAssetAt(input, data.to, data.fx),
    }))
    .filter((position) => !position.value.quantityZero);
  const priced = positions.filter((position) => !position.value.missingFx);
  const total = priced.reduce((sum, position) => sum + position.value.valueBrl, 0);
  const incomes = toIncomeBuckets(data);
  const realized = inputs.map((input) => realizedInPeriod(input, data.from, data.to, data.fx));
  const currentValue = total;
  const invested = priced.reduce((sum, position) => sum + position.value.costBrl, 0);
  const openResult = currentValue - invested;

  return {
    allocation: toAllocation(priced, total),
    incomes,
    period: { bucket: bucketFor(data.from, data.to), from: data.from, to: data.to },
    ranking: toRanking(priced, total),
    series: toSeries(data, inputs),
    summary: {
      assetsWithoutValue: positions.filter(
        (position) => position.value.missingFx || position.value.valueKind === 'COST',
      ).length,
      currentValue,
      historyStartsAt: historyStartsAt(positions, data),
      incomePlanned: incomes.reduce((sum, bucket) => sum + bucket.planned, 0),
      incomeReceived: incomes.reduce((sum, bucket) => sum + bucket.received, 0),
      invested,
      openResult,
      openResultPercent: ratio(openResult, invested),
      operationsWithoutFxRate: positions.reduce(
        (sum, position) => sum + position.value.operationsWithoutFxRate,
        0,
      ),
      realizedResult: realized.reduce((sum, item) => sum + item.cents, 0),
      salesCount: realized.reduce((sum, item) => sum + item.sales, 0),
      staleQuotes: positions.filter(
        (position) => toAssetView(position.row, data.context).market.quote?.stale === true,
      ).length,
    },
  };
}
// The last day of the income series: when the period ends today, the bucket of today reaches its natural end so the
// payments announced for this month show (FR 21). The use case loads incomes up to it.
export function incomeRangeEnd(from: string, to: string, today: string): string {
  return to === today ? bucketEndOf(to, incomeBucketKind(from, to)) : to;
}

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}
function historyStartsAt(positions: Position[], data: DashboardData): null | string {
  const firstClose = new Map<string, string>();

  for (const row of data.closes) {
    const key = quoteKey(row.market, row.ticker);
    const known = firstClose.get(key);

    if (known === undefined || row.date < known) {
      firstClose.set(key, row.date);
    }
  }

  const starts = positions.flatMap((position) => {
    const { asset } = position.input;
    const market = marketOfClass(asset.assetClass);
    const first =
      market && asset.ticker ? firstClose.get(quoteKey(market, asset.ticker)) : undefined;

    // Only a first close after the period start leaves part of the period without closes.
    return first !== undefined && first > data.from ? [first] : [];
  });

  return starts.length === 0
    ? null
    : starts.reduce((latest, date) => (date > latest ? date : latest));
}
function incomeBucketKind(from: string, to: string): DashboardBucket {
  const bucket = bucketFor(from, to);

  return bucket === 'DAY' ? 'WEEK' : bucket;
}
function ratio(part: number, whole: number): null | number {
  return whole === 0 ? null : Math.round((part / whole) * 10000) / 10000;
}
function toAllocation(positions: Position[], total: number): AllocationSlice[] {
  return ALLOCATION_ORDER.flatMap((assetClass) => {
    const items = positions.filter((position) => position.input.asset.assetClass === assetClass);
    const value = items.reduce((sum, position) => sum + position.value.valueBrl, 0);

    if (value === 0) {
      return [];
    }

    const usd = items.flatMap((position) => (position.value.usd ? [position.value.usd] : []));
    const slice: AllocationSlice = { assetClass, share: ratio(value, total) ?? 0, value };

    if (usd.length > 0) {
      slice.usd = {
        fxRate: usd[0]?.fxRate ?? '',
        resultFromAsset: usd.reduce((sum, item) => sum + item.resultFromAsset, 0),
        resultFromFx: usd.reduce((sum, item) => sum + item.resultFromFx, 0),
        value: centsToDecimal(usd.reduce((sum, item) => sum + item.valueUsd, 0)),
      };
    }

    return [slice];
  });
}
function toIncomeBuckets(data: DashboardData): IncomeBucket[] {
  const kind = incomeBucketKind(data.from, data.to);
  const ends = bucketEnds(data.from, data.to, kind);

  if (data.to === data.today) {
    ends[ends.length - 1] = bucketEndOf(data.to, kind);
  }

  const buckets: IncomeBucket[] = ends.map((date) => ({
    byType: Object.fromEntries(
      Object.values(InvestmentIncomeType).map((type) => [type, 0]),
    ) as Record<InvestmentIncomeType, number>,
    date,
    planned: 0,
    received: 0,
  }));

  for (const income of data.incomes) {
    const bucket = buckets.find((candidate) => income.paymentDate <= candidate.date);

    if (!bucket || income.paymentDate < data.from) {
      continue;
    }

    const cents =
      income.currency === 'USD'
        ? convertToBrl(income.netAmount, rateAt(income.paymentDate, data.fx))
        : income.netAmount;

    bucket.byType[income.type] += 1;
    bucket[income.paid ? 'received' : 'planned'] += cents;
  }

  return buckets;
}
function toInput(row: AssetListRow, data: DashboardData): ValuationInput {
  const { latestValuation, operations, ...asset } = row;
  const market = marketOfClass(asset.assetClass);
  const closes =
    market && asset.ticker
      ? data.closes
          .filter((close) => close.market === market && close.ticker === asset.ticker)
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];

  return {
    asset,
    closes,
    fixedIncome: data.context.fixedIncome.get(asset.id),
    operations,
    valuations: data.valuations.get(asset.id) ?? (latestValuation ? [latestValuation] : []),
  };
}
function toRanking(positions: Position[], total: number): RankingRow[] {
  return positions
    .map((position): RankingRow => {
      const { asset } = position.input;
      const { costBrl, usd, valueBrl, valueKind } = position.value;
      const row: RankingRow = {
        assetClass: asset.assetClass,
        assetId: asset.id,
        currency: asset.currency,
        name: asset.name,
        openResult: valueBrl - costBrl,
        openResultPercent: ratio(valueBrl - costBrl, costBrl),
        share: ratio(valueBrl, total) ?? 0,
        ticker: asset.ticker,
        value: valueBrl,
        valueKind,
      };

      if (usd) {
        row.usdValue = centsToDecimal(usd.valueUsd);
      }

      return row;
    })
    .sort((a, b) => b.value - a.value || (a.ticker ?? a.name).localeCompare(b.ticker ?? b.name));
}
function toSeries(data: DashboardData, inputs: ValuationInput[]): SeriesPoint[] {
  const firstOperation = inputs
    .flatMap((input) => input.operations.map((operation) => operation.date))
    .sort()[0];
  const ends = bucketEnds(data.from, data.to, bucketFor(data.from, data.to));

  return ends.map((date) => {
    if (firstOperation === undefined || date < firstOperation) {
      return { date, invested: null, marketValue: null };
    }

    let marketValue = 0;
    let invested = 0;

    for (const input of inputs) {
      const value = valueAssetAt(input, date, data.fx);

      marketValue += value.valueBrl;
      invested += value.costBrl;
    }

    return { date, invested, marketValue };
  });
}
