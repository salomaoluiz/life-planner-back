import {
  MarketIndexFetchEntity,
  MarketIndexFollower,
  MarketIndexFxPair,
  MarketIndexPoint,
} from '@investment/domain/entity/MarketIndexEntity';
import {
  InvestmentFixedIncomeRateMode,
  MarketIndex,
  MarketIndexSeries,
} from '@investment/domain/enum';
import { isStale } from '@investment/domain/service/MarketIndexRules';

const FOLLOWERS_LIMIT = 50;

export interface CdiSummary {
  annual: null | string;
  daily: null | string;
  date: string;
  followers: number;
  lastChangeDate: null | string;
  stale: boolean;
}
export interface IpcaSummary {
  accumulated12m: null | string;
  expected12m: null | string;
  expectedDate: null | string;
  followers: number;
  month: null | string;
  monthly: null | string;
  stale: boolean;
}
export interface MarketIndexesSummary {
  cdi: CdiSummary | null;
  fx: { pair: string; quotedAt: string; rate: string }[];
  ipca: IpcaSummary | null;
  lastSuccessAt: null | string;
  selic: null | SelicSummary;
}
export interface SelicSummary {
  daily: null | string;
  date: string;
  followers: number;
  lastChangeDate: null | string;
  stale: boolean;
  target: null | string;
}

interface SummaryInput {
  changeDates: { cdi: null | string; selic: null | string };
  fetches: MarketIndexFetchEntity[];
  followers: MarketIndexFollower[];
  fx: MarketIndexFxPair[];
  latest: Map<MarketIndexSeries, MarketIndexPoint>;
  today: string;
}

// Spec 113 FR 17: the latest stored value of each index, how stale it is and how many readable titles follow it.
export function buildSummary(input: SummaryInput): MarketIndexesSummary {
  const { latest } = input;
  const cdiMain =
    latest.get(MarketIndexSeries.CDI_ANNUAL) ?? latest.get(MarketIndexSeries.CDI_DAILY);
  const selicMain =
    latest.get(MarketIndexSeries.SELIC_TARGET) ?? latest.get(MarketIndexSeries.SELIC_DAILY);
  const ipcaMain =
    latest.get(MarketIndexSeries.IPCA_MONTHLY) ?? latest.get(MarketIndexSeries.IPCA_12M);
  function staleOf(series: MarketIndexSeries): boolean {
    return isStale(series, latest.get(series)?.date, input.today);
  }
  const successes = input.fetches
    .flatMap((fetch) => (fetch.lastSuccessAt ? [fetch.lastSuccessAt.getTime()] : []))
    .sort((a, b) => b - a);

  return {
    cdi: cdiMain
      ? {
          annual: decimal(latest.get(MarketIndexSeries.CDI_ANNUAL)?.value, 2),
          daily: decimal(latest.get(MarketIndexSeries.CDI_DAILY)?.value, 8),
          date: cdiMain.date,
          followers: countFollowers(input.followers, InvestmentFixedIncomeRateMode.CDI_PERCENT),
          lastChangeDate: input.changeDates.cdi,
          stale: staleOf(MarketIndexSeries.CDI_DAILY),
        }
      : null,
    fx: input.fx.map((pair) => ({
      pair: pair.pair,
      quotedAt: pair.quotedAt.toISOString(),
      rate: pair.rate,
    })),
    ipca: ipcaMain
      ? {
          accumulated12m: decimal(latest.get(MarketIndexSeries.IPCA_12M)?.value, 2),
          expected12m: decimal(latest.get(MarketIndexSeries.IPCA_EXPECTED_12M)?.value, 2),
          expectedDate: latest.get(MarketIndexSeries.IPCA_EXPECTED_12M)?.date ?? null,
          followers: countFollowers(input.followers, InvestmentFixedIncomeRateMode.IPCA_PLUS),
          month: latest.get(MarketIndexSeries.IPCA_MONTHLY)?.date.slice(0, 7) ?? null,
          monthly: decimal(latest.get(MarketIndexSeries.IPCA_MONTHLY)?.value, 2),
          stale: staleOf(MarketIndexSeries.IPCA_MONTHLY),
        }
      : null,
    lastSuccessAt: successes[0] === undefined ? null : new Date(successes[0]).toISOString(),
    selic: selicMain
      ? {
          daily: decimal(latest.get(MarketIndexSeries.SELIC_DAILY)?.value, 8),
          date: selicMain.date,
          // Spec 113 section 2: no "% of Selic" mode exists yet.
          followers: 0,
          lastChangeDate: input.changeDates.selic,
          stale: staleOf(MarketIndexSeries.SELIC_DAILY),
          target: decimal(latest.get(MarketIndexSeries.SELIC_TARGET)?.value, 2),
        }
      : null,
  };
}
// FR 18: the first date of the current run of equal values (rounded to 2 places), `null` without rows.
export function changeDateOf(rows: MarketIndexPoint[]): null | string {
  let since: null | string = null;
  let current: null | string = null;

  for (const row of rows) {
    const value = Number(row.value).toFixed(2);

    if (value !== current) {
      current = value;
      since = row.date;
    }
  }

  return since;
}
// FR 19: one point per change of the annual value, newest change first, with the delta in percentage points.
export function toChanges(
  steps: { date: string; value: string }[],
): { delta: null | string; since: string; value: string }[] {
  return steps
    .map((step, index) => ({
      delta: index === 0 ? null : (Number(step.value) - Number(steps[index - 1]?.value)).toFixed(2),
      since: step.date,
      value: step.value,
    }))
    .reverse();
}
// FR 19: followers of an index, at most 50, in the order they come (by name); Selic has none yet.
export function toFollowers(
  index: MarketIndex,
  followers: MarketIndexFollower[],
): (
  | { assetId: string; name: string; percent: string }
  | { assetId: string; name: string; spread: string }
)[] {
  if (index === MarketIndex.CDI) {
    return followers
      .filter((row) => row.mode === InvestmentFixedIncomeRateMode.CDI_PERCENT)
      .slice(0, FOLLOWERS_LIMIT)
      .map((row) => ({ assetId: row.assetId, name: row.name, percent: row.cdiPercent ?? '0' }));
  }
  if (index === MarketIndex.IPCA) {
    return followers
      .filter((row) => row.mode === InvestmentFixedIncomeRateMode.IPCA_PLUS)
      .slice(0, FOLLOWERS_LIMIT)
      .map((row) => ({ assetId: row.assetId, name: row.name, spread: row.spread ?? '0' }));
  }

  return [];
}
// One point per month: the monthly IPCA with the 12 month accumulated one of the same month.
export function toIpcaPoints(
  monthly: MarketIndexPoint[],
  accumulated: MarketIndexPoint[],
): { accumulated12m: null | string; month: string; monthly: string }[] {
  const byMonth = new Map(accumulated.map((row) => [row.date.slice(0, 7), row.value]));

  return monthly.map((row) => ({
    accumulated12m: decimal(byMonth.get(row.date.slice(0, 7)), 2),
    month: row.date.slice(0, 7),
    monthly: decimal(row.value, 2) as string,
  }));
}
export function toStepPoints(rows: MarketIndexPoint[]): { date: string; value: string }[] {
  const steps: { date: string; value: string }[] = [];

  for (const row of rows) {
    const value = Number(row.value).toFixed(2);

    if (steps[steps.length - 1]?.value !== value) {
      steps.push({ date: row.date, value });
    }
  }

  return steps;
}

function countFollowers(
  followers: MarketIndexFollower[],
  mode: InvestmentFixedIncomeRateMode,
): number {
  return followers.filter((row) => row.mode === mode).length;
}
function decimal(value: string | undefined, places: number): null | string {
  return value === undefined ? null : Number(value).toFixed(places);
}
