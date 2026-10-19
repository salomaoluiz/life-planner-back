import { RecurrenceFrequency } from '@finance/domain/enum';

export interface RecurrenceRule {
  // Inclusive; null/undefined = no end.
  endDate?: null | string;
  frequency: RecurrenceFrequency;
  // Date of occurrence 1 (`YYYY-MM-DD`).
  startDate: string;
}
export interface ScheduledOccurrence {
  date: string;
  // Position inside the series, from 1.
  k: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Spec 034 FR 4: occurrences dated up to `endDate` (inclusive).
export function countUntil(rule: RecurrenceRule, endDate: string): number {
  return occurrencesBetween({ ...rule, endDate: null }, rule.startDate, endDate).length;
}
export function lastDayOfMonth(date: string): string {
  const [year, month] = parts(date);

  return format(year, month, daysInMonth(year, month));
}

// Spec 034 FR 3: always computed from the start date, never from the previous occurrence.
export function occurrenceDate(rule: RecurrenceRule, k: number): string {
  const [year, month, day] = parts(rule.startDate);
  const step = k - 1;

  switch (rule.frequency) {
    case RecurrenceFrequency.BIWEEKLY:
      return addDays(rule.startDate, step * 14);
    case RecurrenceFrequency.MONTHLY:
      return inMonth(year, month - 1 + step, day);
    case RecurrenceFrequency.WEEKLY:
      return addDays(rule.startDate, step * 7);
    case RecurrenceFrequency.YEARLY:
      return inMonth(year + step, month - 1, day);
  }
}
export function occurrencesBetween(
  rule: RecurrenceRule,
  from: string,
  to: string,
): ScheduledOccurrence[] {
  const result: ScheduledOccurrence[] = [];

  for (let k = 1; ; k += 1) {
    const date = occurrenceDate(rule, k);

    if (date > to || (rule.endDate && date > rule.endDate)) {
      return result;
    }
    if (date >= from) {
      result.push({ date, k });
    }
  }
}

function addDays(date: string, days: number): string {
  const [year, month, day] = parts(date);
  const next = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);

  return format(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function format(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
// `monthIndex` is 0-based and may overflow into other years; the day clamps to the month length.
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
