import { MarketIndexSeries } from '@investment/domain/enum';
import { businessDays } from '@investment/domain/service/BusinessDayCalendar';
import { addDays } from '@investment/domain/service/MarketDate';

const DAILY_STALE_BUSINESS_DAYS = 4;
const EXPECTATION_STALE_BUSINESS_DAYS = 10;
const MONTHLY_STALE_DAYS = 45;

// Spec 113 FR 2: a value outside these limits is not stored.
const LIMITS: Record<MarketIndexSeries, { max: number; min: number; minExclusive: boolean }> = {
  [MarketIndexSeries.CDI_ANNUAL]: { max: 60, min: 0, minExclusive: true },
  [MarketIndexSeries.CDI_DAILY]: { max: 0.2, min: 0, minExclusive: true },
  [MarketIndexSeries.IPCA_12M]: { max: 100, min: -10, minExclusive: false },
  [MarketIndexSeries.IPCA_EXPECTED_12M]: { max: 100, min: -10, minExclusive: false },
  [MarketIndexSeries.IPCA_MONTHLY]: { max: 10, min: -5, minExclusive: false },
  [MarketIndexSeries.SELIC_DAILY]: { max: 0.2, min: 0, minExclusive: true },
  [MarketIndexSeries.SELIC_TARGET]: { max: 60, min: 0, minExclusive: true },
};

export function isInRange(series: MarketIndexSeries, value: number): boolean {
  const { max, min, minExclusive } = LIMITS[series];

  return Number.isFinite(value) && value <= max && (minExclusive ? value > min : value >= min);
}
// FR 7: stale when the latest stored date is older than the series allows (a missing series is stale). A monthly
// IPCA is dated the first day of its month and published a few days after it ends, so its age counts from the end
// of the reference month.
export function isStale(
  series: MarketIndexSeries,
  latestDate: string | undefined,
  today: string,
): boolean {
  if (!latestDate) {
    return true;
  }

  switch (series) {
    case MarketIndexSeries.IPCA_12M:
    case MarketIndexSeries.IPCA_MONTHLY:
      return today > addDays(endOfMonth(latestDate), MONTHLY_STALE_DAYS);
    case MarketIndexSeries.IPCA_EXPECTED_12M:
      return businessDays(latestDate, today) > EXPECTATION_STALE_BUSINESS_DAYS;
    default:
      return businessDays(latestDate, today) > DAILY_STALE_BUSINESS_DAYS;
  }
}
export function sourceOf(series: MarketIndexSeries): string {
  return series === MarketIndexSeries.IPCA_EXPECTED_12M ? 'BCB_FOCUS' : 'BCB_SGS';
}

function endOfMonth(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${date.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}
