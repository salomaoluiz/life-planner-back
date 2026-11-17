import { RecurrenceUnit } from '@finance/domain/enum';
import {
  isIntervalAllowed,
  RECURRENCE_INTERVAL_LIMITS,
} from '@finance/domain/service/RecurrenceInterval';

describe('RECURRENCE_INTERVAL_LIMITS', () => {
  it('holds the spec 114 limit of each unit', () => {
    expect(RECURRENCE_INTERVAL_LIMITS).toEqual({ DAY: 365, MONTH: 24, WEEK: 52, YEAR: 10 });
  });
});

describe('isIntervalAllowed', () => {
  it.each(Object.values(RecurrenceUnit))('accepts 1 and the maximum of %s', (unit) => {
    expect(isIntervalAllowed(unit, 1)).toBe(true);
    expect(isIntervalAllowed(unit, RECURRENCE_INTERVAL_LIMITS[unit])).toBe(true);
  });

  it.each(Object.values(RecurrenceUnit))(
    'refuses 0, the maximum + 1 and fractions of %s',
    (unit) => {
      expect(isIntervalAllowed(unit, 0)).toBe(false);
      expect(isIntervalAllowed(unit, RECURRENCE_INTERVAL_LIMITS[unit] + 1)).toBe(false);
      expect(isIntervalAllowed(unit, 1.5)).toBe(false);
    },
  );
});
