import { addDays } from '@investment/domain/service/MarketDate';

export type DashboardBucket = 'DAY' | 'MONTH' | 'WEEK';

const MAX_DAY_SPAN = 45;
const MAX_WEEK_SPAN = 92;
const MS_PER_DAY = 86_400_000;

// Spec 110 FR 12: a point per day up to 45 days (1M), per week up to 92 days (3M), per month above (6M, 12M, YEAR
// and long custom ranges; a custom range of 93 to ~180 days is monthly too, so the presets keep the artboard's look).
export function bucketFor(from: string, to: string): DashboardBucket {
  const days = daysBetween(from, to);

  if (days <= MAX_DAY_SPAN) {
    return 'DAY';
  }

  return days <= MAX_WEEK_SPAN ? 'WEEK' : 'MONTH';
}
// The last day of every bucket in [from, to]; the last bucket is clipped to `to` (the value "at the period end").
export function bucketEnds(from: string, to: string, bucket: DashboardBucket): string[] {
  const ends: string[] = [];
  let cursor = from;

  while (cursor <= to) {
    const end = endOf(cursor, bucket);

    if (end >= to) {
      break;
    }

    ends.push(end);
    cursor = addDays(end, 1);
  }

  ends.push(to);

  return ends;
}
// Spec 110 FR 21: income is never finer than a week.
export function incomeBucketEnds(from: string, to: string): string[] {
  const bucket = bucketFor(from, to);

  return bucketEnds(from, to, bucket === 'DAY' ? 'WEEK' : bucket);
}

function daysBetween(from: string, to: string): number {
  return (
    Math.round(
      (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / MS_PER_DAY,
    ) + 1
  );
}
function endOf(date: string, bucket: DashboardBucket): string {
  if (bucket === 'DAY') {
    return date;
  }

  const value = new Date(`${date}T00:00:00.000Z`);

  if (bucket === 'WEEK') {
    // Sunday (ISO week): 0 days ahead on a Sunday.
    return addDays(date, (7 - value.getUTCDay()) % 7);
  }

  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}
