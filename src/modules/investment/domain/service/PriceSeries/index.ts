import { addDays } from '@investment/domain/service/MarketDate';

export interface PricePoint {
  date: string;
  kind: PricePointKind;
  price: string;
}
export type PricePointKind = 'CLOSE' | 'OPERATION' | 'VALUATION';
export type PriceRange = '1M' | '1Y' | '6M' | 'ALL';
export interface PriceSeries {
  historyStartsAt: null | string;
  points: PricePoint[];
}

export const MAX_POINTS = 400;
const MAX_ALL_DAYS = 3650;

// Spec 104 FR 29, 30: daily closes in range, with synthetic points (operations, manual valuations) only before the
// first stored close; above 400 points the closes are cut to the last close of each week.
export function buildPriceSeries(input: {
  closes: { date: string; price: string }[];
  now: string;
  operations: { date: string; price: string }[];
  range: PriceRange;
  valuations: { date: string; price: string }[];
}): PriceSeries {
  const from = rangeStart(input.range, input.now);
  const closes = input.closes
    .filter((row) => row.date >= from && row.date <= input.now)
    .sort((a, b) => a.date.localeCompare(b.date));
  const stored = [...input.closes].sort((a, b) => a.date.localeCompare(b.date));
  const historyStartsAt = stored[0]?.date ?? null;
  const synthetic: PricePoint[] = [
    ...input.operations.map((row) => ({ ...row, kind: 'OPERATION' as const })),
    ...input.valuations.map((row) => ({ ...row, kind: 'VALUATION' as const })),
  ]
    .filter((row) => row.date >= from && (historyStartsAt === null || row.date < historyStartsAt))
    .map((row) => ({ date: row.date, kind: row.kind, price: row.price }));
  const closePoints: PricePoint[] = closes.map((row) => ({
    date: row.date,
    kind: 'CLOSE',
    price: row.price,
  }));
  const reduced = closePoints.length > MAX_POINTS ? weekly(closePoints) : closePoints;

  return {
    historyStartsAt,
    points: [...synthetic, ...reduced].sort(
      (a, b) => a.date.localeCompare(b.date) || kindOrder(a.kind) - kindOrder(b.kind),
    ),
  };
}
export function rangeStart(range: PriceRange, now: string): string {
  switch (range) {
    case '1M':
      return addMonths(now, -1);
    case '1Y':
      return addMonths(now, -12);
    case '6M':
      return addMonths(now, -6);
    default:
      return addDays(now, -MAX_ALL_DAYS);
  }
}

function addMonths(date: string, months: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() + months);

  return value.toISOString().slice(0, 10);
}
function kindOrder(kind: PricePointKind): number {
  return kind === 'CLOSE' ? 1 : 0;
}
// The last close of each ISO week (weeks start on Monday).
function weekly(points: PricePoint[]): PricePoint[] {
  const byWeek = new Map<string, PricePoint>();

  for (const point of points) {
    const day = new Date(`${point.date}T00:00:00.000Z`).getUTCDay();
    const monday = addDays(point.date, -((day + 6) % 7));

    byWeek.set(monday, point);
  }

  return [...byWeek.values()];
}
