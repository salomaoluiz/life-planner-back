import { IncomeSeriesUnit } from '@investment/domain/enum';

// Spec 115 FR 8-9, 13, 16: the dates of a series. Same math as finance's `RecurrenceSchedule` (spec 114), mirrored
// here because modules never import each other. Dates are `YYYY-MM-DD`.
export interface IncomeSeriesFrequency {
  interval: number;
  unit: IncomeSeriesUnit;
}
export interface IncomeSeriesRule {
  // Inclusive; null = no end.
  endDate?: null | string;
  exDateOffsetDays?: null | number;
  firstNumber?: number;
  frequency: IncomeSeriesFrequency;
  // Date of the first occurrence.
  firstPaymentDate: string;
}
export interface ScheduledIncome {
  exDate: string;
  // Displayed number: `firstNumber - 1 + k`.
  number: number;
  paymentDate: string;
}

export const MAX_OCCURRENCES_PER_CREATE = 600;
export const EX_DATE_OFFSET_MAX = 90;
export const INTERVAL_LIMITS: Record<IncomeSeriesUnit, number> = {
  [IncomeSeriesUnit.DAY]: 365,
  [IncomeSeriesUnit.MONTH]: 24,
  [IncomeSeriesUnit.WEEK]: 52,
  [IncomeSeriesUnit.YEAR]: 10,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: string, days: number): string {
  const [year, month, day] = parts(date);
  const next = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);

  return format(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}
export function exDateOf(paymentDate: string, offsetDays?: null | number): string {
  return offsetDays ? addDays(paymentDate, -offsetDays) : paymentDate;
}
export function isIntervalAllowed(unit: IncomeSeriesUnit, interval: number): boolean {
  return Number.isInteger(interval) && interval >= 1 && interval <= INTERVAL_LIMITS[unit];
}
export function lastDayOfMonth(date: string): string {
  const [year, month] = parts(date);

  return format(year, month, daysInMonth(year, month));
}
// FR 9: always computed from the first date, never from the previous occurrence (month-end clamp, leap years).
export function occurrenceDate(rule: IncomeSeriesRule, k: number): string {
  const [year, month, day] = parts(rule.firstPaymentDate);
  const step = (k - 1) * rule.frequency.interval;

  switch (rule.frequency.unit) {
    case IncomeSeriesUnit.DAY:
      return addDays(rule.firstPaymentDate, step);
    case IncomeSeriesUnit.MONTH:
      return inMonth(year, month - 1 + step, day);
    case IncomeSeriesUnit.WEEK:
      return addDays(rule.firstPaymentDate, step * 7);
    case IncomeSeriesUnit.YEAR:
      return inMonth(year + step, month - 1, day);
  }
}
// FR 13: occurrences dated from `from` to `to` (inclusive), cut by the end date. `limit` bounds the walk.
export function occurrencesBetween(
  rule: IncomeSeriesRule,
  from: string,
  to: string,
  limit: number = MAX_OCCURRENCES_PER_CREATE + 1,
): ScheduledIncome[] {
  const result: ScheduledIncome[] = [];
  const firstNumber = rule.firstNumber ?? 1;

  for (let k = 1; result.length < limit; k += 1) {
    const paymentDate = occurrenceDate(rule, k);

    if (paymentDate > to || (rule.endDate && paymentDate > rule.endDate)) {
      break;
    }
    if (paymentDate >= from) {
      result.push({
        exDate: exDateOf(paymentDate, rule.exDateOffsetDays),
        number: firstNumber - 1 + k,
        paymentDate,
      });
    }
  }

  return result;
}
// Occurrences of the series after `after` (exclusive) up to `to`, for the projections (FR 21).
export function occurrencesAfter(
  rule: IncomeSeriesRule,
  after: string,
  to: string,
  limit: number = MAX_OCCURRENCES_PER_CREATE,
): ScheduledIncome[] {
  return occurrencesBetween(rule, addDays(after, 1), to, limit);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function format(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function inMonth(year: number, monthIndex: number, day: number): string {
  const absolute = year * 12 + monthIndex;
  const targetYear = Math.floor(absolute / 12);
  const targetMonth = (absolute % 12) + 1;

  return format(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}
function parts(date: string): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number);

  return [year, month, day];
}
