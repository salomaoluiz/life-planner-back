import { IncomeSeriesUnit } from '@investment/domain/enum';
import {
  exDateOf,
  isIntervalAllowed,
  lastDayOfMonth,
  occurrenceDate,
  occurrencesAfter,
  occurrencesBetween,
} from '@investment/domain/service/IncomeSeriesSchedule';

function monthly(firstPaymentDate: string, extra = {}) {
  return {
    firstPaymentDate,
    frequency: { interval: 1, unit: IncomeSeriesUnit.MONTH },
    ...extra,
  };
}

describe('IncomeSeriesSchedule', () => {
  it('steps every unit from the first date', () => {
    expect(
      occurrenceDate(
        { firstPaymentDate: '2026-01-10', frequency: { interval: 3, unit: IncomeSeriesUnit.DAY } },
        3,
      ),
    ).toBe('2026-01-16');
    expect(
      occurrenceDate(
        { firstPaymentDate: '2026-01-10', frequency: { interval: 2, unit: IncomeSeriesUnit.WEEK } },
        2,
      ),
    ).toBe('2026-01-24');
    expect(occurrenceDate(monthly('2026-01-15'), 13)).toBe('2027-01-15');
    expect(
      occurrenceDate(
        { firstPaymentDate: '2026-03-01', frequency: { interval: 2, unit: IncomeSeriesUnit.YEAR } },
        2,
      ),
    ).toBe('2028-03-01');
  });

  it('clamps to the month end and never drifts', () => {
    const rule = monthly('2026-01-31');

    expect(occurrenceDate(rule, 2)).toBe('2026-02-28');
    expect(occurrenceDate(rule, 3)).toBe('2026-03-31');
  });

  it('keeps 29/02 on leap years only', () => {
    const rule = {
      firstPaymentDate: '2024-02-29',
      frequency: { interval: 1, unit: IncomeSeriesUnit.YEAR },
    };

    expect(occurrenceDate(rule, 2)).toBe('2025-02-28');
    expect(occurrenceDate(rule, 5)).toBe('2028-02-29');
  });

  it('lists occurrences between two dates with numbers and ex-dates, cut by the end date', () => {
    const rule = monthly('2025-01-15', { endDate: '2025-04-20', exDateOffsetDays: 8 });

    expect(occurrencesBetween(rule, '2025-01-01', '2026-12-31')).toEqual([
      { exDate: '2025-01-07', number: 1, paymentDate: '2025-01-15' },
      { exDate: '2025-02-07', number: 2, paymentDate: '2025-02-15' },
      { exDate: '2025-03-07', number: 3, paymentDate: '2025-03-15' },
      { exDate: '2025-04-07', number: 4, paymentDate: '2025-04-15' },
    ]);
  });

  it('continues the counter of a split series', () => {
    const rule = monthly('2026-11-15', { firstNumber: 23 });

    expect(occurrencesBetween(rule, '2026-11-01', '2026-12-31').map((item) => item.number)).toEqual(
      [23, 24],
    );
  });

  it('counts 22 past plus the current month for the monthly example of the spec', () => {
    const past = occurrencesBetween(monthly('2025-01-15'), '2025-01-01', '2026-11-11');
    const current = occurrencesAfter(monthly('2025-01-15'), '2026-11-11', '2026-11-30');

    expect(past).toHaveLength(22);
    expect(current.map((item) => item.paymentDate)).toEqual(['2026-11-15']);
  });

  it('bounds the walk at 601 occurrences', () => {
    const daily = {
      firstPaymentDate: '2020-01-01',
      frequency: { interval: 1, unit: IncomeSeriesUnit.DAY },
    };

    expect(occurrencesBetween(daily, '2020-01-01', '2030-01-01')).toHaveLength(601);
  });

  it('helpers', () => {
    expect(exDateOf('2026-01-02', null)).toBe('2026-01-02');
    expect(exDateOf('2026-01-02', 3)).toBe('2025-12-30');
    expect(lastDayOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(isIntervalAllowed(IncomeSeriesUnit.MONTH, 24)).toBe(true);
    expect(isIntervalAllowed(IncomeSeriesUnit.MONTH, 25)).toBe(false);
    expect(isIntervalAllowed(IncomeSeriesUnit.DAY, 0)).toBe(false);
  });
});
