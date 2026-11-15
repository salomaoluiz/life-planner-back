import { addDays } from '@investment/domain/service/MarketDate';

// Spec 110 FR 12: how many points the charts get, picked from the range by the server.
export interface DashboardBucket {
  // Last day of the bucket, inclusive.
  end: string;
  start: string;
}
export type DashboardBucketUnit = 'DAY' | 'MONTH' | 'WEEK';

const MS_PER_DAY = 86_400_000;
const MAX_DAY_DAYS = 45;
const MAX_WEEK_DAYS = 100;

// Spec 110 FR 12: daily up to 45 days, weekly up to ~3 months, monthly above.
export function bucketUnitFor(from: string, to: string): DashboardBucketUnit {
  const days = daysBetween(from, to);

  if (days <= MAX_DAY_DAYS) {
    return 'DAY';
  }

  return days <= MAX_WEEK_DAYS ? 'WEEK' : 'MONTH';
}
// Contiguous buckets from `from` to `to`: weeks end on Sunday and the last bucket is cut at `to`.
export function bucketsFor(from: string, to: string): DashboardBucket[] {
  const unit = bucketUnitFor(from, to);

  if (unit === 'DAY') {
    return daysOf(from, to).map((date) => ({ end: date, start: date }));
  }

  if (unit === 'WEEK') {
    const buckets: DashboardBucket[] = [];
    let start = from;

    while (start <= to) {
      const day = dayOfWeek(start);
      const end = addDays(start, (7 - day) % 7);
      const clamped = end > to ? to : end;

      buckets.push({ end: clamped, start });
      start = addDays(clamped, 1);
    }

    return buckets;
  }

  const buckets: DashboardBucket[] = [];
  let start = from;

  while (start <= to) {
    const monthEnd = endOfMonthOf(start);
    const end = monthEnd > to ? to : monthEnd;

    buckets.push({ end, start });
    start = addDays(end, 1);
  }

  return buckets;
}
export function daysBetween(from: string, to: string): number {
  return Math.round((dayNumber(to) - dayNumber(from)) / MS_PER_DAY) + 1;
}

function dayNumber(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getTime();
}
function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}
function daysOf(from: string, to: string): string[] {
  const days: string[] = [];
  let date = from;

  while (date <= to) {
    days.push(date);
    date = addDays(date, 1);
  }

  return days;
}
// The last calendar day of the month of `date` (spec 110 FR 21: planned incomes of the current month).
export function endOfMonthOf(date: string): string {
  const [year, month] = date.split('-').map(Number);
  const last = new Date(Date.UTC(year ?? 0, month ?? 1, 0)).getUTCDate();

  return `${String(year)}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}
