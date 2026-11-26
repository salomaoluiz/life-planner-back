const DAY_MS = 86_400_000;
const MAX_INTERVAL_DAYS = 90;
const MIN_INTERVAL_DAYS = 1;
const MAX_GAPS = 6;
const MIN_PURCHASES = 3;

function days(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

// Spec 123 FR 10: last closed purchase + interval, rolled forward while it is before today; no purchase → today +
// interval. The SQL of the restock sync (`RestockSync`) mirrors this rule; keep both in step.
export function nextTripDate(lastClosed: Date | undefined, interval: number, today: Date): Date {
  if (!lastClosed) {
    return new Date(today.getTime() + interval * DAY_MS);
  }

  const cycles = Math.max(1, Math.ceil(days(lastClosed, today) / interval));

  return new Date(lastClosed.getTime() + cycles * interval * DAY_MS);
}

// FR 11: median gap between the last (up to 7) closed purchases; needs 3 of them.
export function suggestedInterval(closedDates: Date[]): null | number {
  if (closedDates.length < MIN_PURCHASES) {
    return null;
  }

  const sorted = [...closedDates].sort((a, b) => b.getTime() - a.getTime()).slice(0, MAX_GAPS + 1);
  const gaps = sorted
    .slice(0, -1)
    .map((date, index) => days(sorted[index + 1], date))
    .sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 === 1 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2;

  return Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, Math.round(median)));
}
