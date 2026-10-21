import { isPeriodValid } from '@finance/domain/entity/TransactionFilter';
import { addDays, lastDayOfMonth } from '@finance/domain/service/RecurrenceSchedule';

// Spec 046: pure calendar math of the dashboard (buckets, granularity, previous period). Dates are `YYYY-MM-DD`.
export interface Bucket {
  end: string;
  start: string;
}
export type Granularity = 'DAY' | 'MONTH' | 'WEEK';

const MAX_DAY_SPAN = 92;
const MAX_WEEK_SPAN = 366;
const MS_PER_DAY = 86_400_000;

export function buildBuckets(from: string, to: string, granularity: Granularity): Bucket[] {
  const buckets: Bucket[] = [];
  let start = from;

  while (start <= to) {
    const natural = naturalEnd(start, granularity);
    const end = natural < to ? natural : to;

    buckets.push({ end, start });
    start = addDays(end, 1);
  }

  return buckets;
}
export function defaultGranularity(from: string, to: string): Granularity {
  const days = spanInDays(from, to);

  if (days <= 31) {
    return 'DAY';
  }

  return days <= MAX_DAY_SPAN ? 'WEEK' : 'MONTH';
}
export function isDashboardPeriodValid(from: string, to: string, today: string): boolean {
  return isPeriodValid(from, to) && to <= lastDayOfMonth(today);
}
export function isGranularityAllowed(granularity: Granularity, from: string, to: string): boolean {
  const days = spanInDays(from, to);

  if (granularity === 'DAY') {
    return days <= MAX_DAY_SPAN;
  }

  return granularity === 'WEEK' ? days <= MAX_WEEK_SPAN : true;
}

// Same length, ending the day before `from`; whole-month periods shift by whole months (12M → previous 12M).
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const previousTo = addDays(from, -1);

  if (from.endsWith('-01') && to === lastDayOfMonth(to)) {
    const months = monthIndex(to) - monthIndex(from) + 1;

    return { from: shiftMonths(from, -months), to: previousTo };
  }

  return { from: addDays(from, -spanInDays(from, to)), to: previousTo };
}

function monthIndex(date: string): number {
  const [year, month] = date.split('-').map(Number);

  return year * 12 + month - 1;
}
function naturalEnd(start: string, granularity: Granularity): string {
  if (granularity === 'DAY') {
    return start;
  }
  if (granularity === 'MONTH') {
    return lastDayOfMonth(start);
  }

  // Monday = 1 … Sunday = 7.
  const weekday = new Date(`${start}T00:00:00Z`).getUTCDay() || 7;

  return addDays(start, 7 - weekday);
}
function shiftMonths(date: string, months: number): string {
  const index = monthIndex(date) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;

  return `${year}-${String(month).padStart(2, '0')}-${date.slice(8, 10)}`;
}
function spanInDays(from: string, to: string): number {
  return (
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY) + 1
  );
}
