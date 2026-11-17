import { RecurrenceUnit } from '@finance/domain/enum';

// Spec 114: the rule of a series, "every `interval` `unit`s".
export interface RecurrenceFrequency {
  interval: number;
  unit: RecurrenceUnit;
}

// Inclusive upper bound of `interval` per unit (the lower bound is always 1); mirrored by a DB CHECK.
export const RECURRENCE_INTERVAL_LIMITS: Record<RecurrenceUnit, number> = {
  [RecurrenceUnit.DAY]: 365,
  [RecurrenceUnit.MONTH]: 24,
  [RecurrenceUnit.WEEK]: 52,
  [RecurrenceUnit.YEAR]: 10,
};

export function isIntervalAllowed(unit: RecurrenceUnit, interval: number): boolean {
  return (
    Number.isInteger(interval) && interval >= 1 && interval <= RECURRENCE_INTERVAL_LIMITS[unit]
  );
}
