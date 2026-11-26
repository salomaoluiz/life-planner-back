import { StockUnits } from '@stock/domain/entity/StockEntity';
import { compareNullsLast } from '@stock/domain/service/NullsLast';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';

// Spec 123 FR 1-8, 16, 22, 23, 33: every rule of the consumption forecast, pure.
export type ForecastStatus = 'INSUFFICIENT_DATA' | 'NO_CONSUMPTION' | 'OK';

// One calendar day of the window (`ageDays` = days before today, 1 = yesterday). `startQuantity` is the item quantity
// at the start of that day, rebuilt by the caller; days at 0 never count (FR 3).
export interface ConsumptionDay {
  ageDays: number;
  consumed: number;
  startQuantity: number;
}
export interface ForecastInput {
  // CONSUME movements in the window.
  consumeCount: number;
  days: ConsumptionDay[];
  quantity: number;
  // Days between the first and the last CONSUME of the window.
  minQuantity?: number;
  spanDays: number;
  today: Date;
  unit: StockUnits;
}
export interface ForecastResult {
  dailyRate: number;
  emptyDate?: Date;
  minDate?: Date;
  status: ForecastStatus;
}
export interface Leftover {
  date: Date;
  lotId: string;
  quantity: number;
}
export interface LeftoverLot {
  effectiveExpiration?: Date;
  id: string;
  openedAt?: Date;
  quantity: number;
}

const DAY_MS = 86_400_000;
const HALF_LIFE_DAYS = 28;
const MIN_COUNTED_DAYS = 14;
const MIN_SPAN_DAYS = 14;
const MIN_CONSUMES = 2;
const KG_LITER_LEFTOVER_MILLI = 50;

export function computeForecast(input: ForecastInput): ForecastResult {
  const counted = input.days.filter((entry) => entry.startQuantity > 0);

  if (
    input.consumeCount < MIN_CONSUMES ||
    input.spanDays < MIN_SPAN_DAYS ||
    counted.length < MIN_COUNTED_DAYS
  ) {
    return { dailyRate: 0, status: 'INSUFFICIENT_DATA' };
  }

  let weighted = 0;
  let weights = 0;

  for (const entry of counted) {
    const weight = 0.5 ** (entry.ageDays / HALF_LIFE_DAYS);

    weighted += weight * entry.consumed;
    weights += weight;
  }

  const dailyRate = fromMilli(Math.round((weighted / weights) * 1000));

  if (dailyRate <= 0) {
    return { dailyRate: 0, status: 'NO_CONSUMPTION' };
  }

  const toMin = Math.max(0, Math.floor((input.quantity - (input.minQuantity ?? 0)) / dailyRate));
  const toEmpty = Math.max(0, Math.floor(input.quantity / dailyRate));

  return {
    dailyRate,
    emptyDate: addDays(input.today, toEmpty),
    minDate: addDays(input.today, toMin),
    status: 'OK',
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
function ceilMilli(value: number): number {
  return Math.ceil(value * 1000 - 1e-6) / 1000;
}
function leftoverThresholdMilli(unit: StockUnits): number {
  return unit === StockUnits.UNIT ? 1000 : KG_LITER_LEFTOVER_MILLI;
}

// FR 16: the quantity of the FORECAST row; 0 means no row.
export function forecastQuantity(input: {
  daysToTrip: number;
  idealQuantity?: number;
  intervalDays: number;
  quantity: number;
  rate: number;
  unit: StockUnits;
}): number {
  const raw =
    input.idealQuantity === undefined
      ? input.rate * input.intervalDays
      : input.idealQuantity - projectedOnTrip(input.quantity, input.rate, input.daysToTrip);

  if (raw <= 0) {
    return 0;
  }

  return input.unit === StockUnits.UNIT ? Math.ceil(raw - 1e-6) : ceilMilli(raw);
}

// Leftovers of every lot that is not used before it expires (FR 22): consumption follows the 116 order (open lots,
// then by expiration, nulls last).
export function leftoverFor(input: {
  lots: LeftoverLot[];
  rate: number;
  today: Date;
  unit: StockUnits;
}): Leftover[] {
  if (input.rate <= 0) {
    return [];
  }

  const ordered = [...input.lots]
    .filter((lot) => lot.quantity > 0)
    .sort(
      (a, b) =>
        Number(Boolean(b.openedAt)) - Number(Boolean(a.openedAt)) ||
        compareNullsLast(a.effectiveExpiration?.getTime(), b.effectiveExpiration?.getTime()) ||
        a.id.localeCompare(b.id),
    );
  const threshold = leftoverThresholdMilli(input.unit);
  const result: Leftover[] = [];
  let before = 0;

  for (const lot of ordered) {
    if (lot.effectiveExpiration) {
      const days = Math.round((lot.effectiveExpiration.getTime() - input.today.getTime()) / DAY_MS);
      const used = Math.min(lot.quantity, Math.max(0, input.rate * Math.max(days, 0) - before));
      const milli = toMilli(lot.quantity) - toMilli(used);
      const left = input.unit === StockUnits.UNIT ? Math.floor(milli / 1000) * 1000 : milli;

      if (days >= 0 && left >= threshold) {
        result.push({ date: lot.effectiveExpiration, lotId: lot.id, quantity: fromMilli(left) });
      }
    }

    before += lot.quantity;
  }

  return result;
}

// FR 23/25: the worst leftover that is not dismissed (a dismissed lot returns when its leftover grew by 1 unit /
// 0.050 kg-L over the dismissed value).
export function pickLeftover(
  leftovers: Leftover[],
  dismissed: Map<string, number>,
  unit: StockUnits = StockUnits.UNIT,
): Leftover | null {
  const growth = leftoverThresholdMilli(unit);
  const visible = leftovers.filter((entry) => {
    const seen = dismissed.get(entry.lotId);

    return seen === undefined || toMilli(entry.quantity) - toMilli(seen) >= growth;
  });

  return (
    [...visible].sort((a, b) => b.quantity - a.quantity || a.lotId.localeCompare(b.lotId))[0] ??
    null
  );
}
export function projectedOnTrip(quantity: number, rate: number, daysToTrip: number): number {
  return Math.max(0, fromMilli(Math.round((quantity - rate * daysToTrip) * 1000)));
}

// FR 33.
export interface DayMovements {
  // Days before today (0 = today).
  ageDays: number;
  // Positive CONSUME quantity of the day.
  consumed: number;
  // Net signed quantity change of the day (every type except OPEN).
  delta: number;
}

export function wasteRatio(discarded: number, entered: number): null | number {
  return entered > 0 ? Math.round((discarded / entered) * 10_000) / 10_000 : null;
}

// FR 2-3: the 90 days up to yesterday with the quantity at the start of each day, rebuilt backwards from the current
// quantity and the deltas of the window (today's included).
export interface ConsumptionWeek {
  excluded: boolean;
  quantity: number;
  start: Date;
}

export function buildWindowDays(
  quantity: number,
  perDay: DayMovements[],
  windowDays = 90,
): ConsumptionDay[] {
  const byAge = new Map(perDay.map((entry) => [entry.ageDays, entry]));
  const days: ConsumptionDay[] = [];
  let start = toMilli(quantity) - toMilli(byAge.get(0)?.delta ?? 0);

  for (let ageDays = 1; ageDays <= windowDays; ageDays += 1) {
    const entry = byAge.get(ageDays);

    start -= toMilli(entry?.delta ?? 0);
    days.push({ ageDays, consumed: entry?.consumed ?? 0, startQuantity: fromMilli(start) });
  }

  return days;
}

// Spec 123 FR 19: the last 12 weeks (Monday to Sunday, oldest first, the current week last) of CONSUME quantity; a
// week with the item at zero on every day is `excluded` ("fora da média").
export function weeklyConsumption(
  quantity: number,
  perDay: DayMovements[],
  today: Date,
  weeks = 12,
): ConsumptionWeek[] {
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  const windowDays = sinceMonday + weeks * 7;
  const days = buildWindowDays(quantity, perDay, windowDays);
  const todayConsumed = perDay.find((entry) => entry.ageDays === 0)?.consumed ?? 0;
  const todayStart =
    toMilli(quantity) - toMilli(perDay.find((entry) => entry.ageDays === 0)?.delta ?? 0);
  const byAge = new Map<number, { consumed: number; start: number }>([
    [0, { consumed: todayConsumed, start: fromMilli(todayStart) }],
    ...days.map((day): [number, { consumed: number; start: number }] => [
      day.ageDays,
      { consumed: day.consumed, start: day.startQuantity },
    ]),
  ]);

  return Array.from({ length: weeks }, (_, index) => {
    const weeksBack = weeks - 1 - index;
    const firstAge = sinceMonday + weeksBack * 7;
    const ages = Array.from({ length: 7 }, (_unused, offset) => firstAge - offset).filter(
      (age) => age >= 0,
    );
    const entries = ages.map((age) => byAge.get(age) ?? { consumed: 0, start: 0 });

    return {
      excluded: entries.every((entry) => entry.start <= 0),
      quantity: fromMilli(entries.reduce((sum, entry) => sum + toMilli(entry.consumed), 0)),
      start: addDays(today, -firstAge),
    };
  });
}
