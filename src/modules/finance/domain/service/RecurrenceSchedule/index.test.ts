import { RecurrenceUnit } from '@finance/domain/enum';
import {
  addDays,
  countUntil,
  lastDayOfMonth,
  occurrenceDate,
  occurrencesBetween,
  planMaterialization,
  RecurrenceRule,
  toOccurrenceRows,
  totalOccurrences,
  upcomingOccurrences,
} from '@finance/domain/service/RecurrenceSchedule';

function monthly(startDate: string, endDate?: string): RecurrenceRule {
  return { endDate, frequency: { interval: 1, unit: RecurrenceUnit.MONTH }, startDate };
}

describe('occurrenceDate', () => {
  it('clamps a monthly 31st to the end of shorter months, always from the start date', () => {
    const rule = monthly('2026-01-31');

    expect(occurrenceDate(rule, 1)).toBe('2026-01-31');
    expect(occurrenceDate(rule, 2)).toBe('2026-02-28');
    expect(occurrenceDate(rule, 3)).toBe('2026-03-31');
    expect(occurrenceDate(rule, 4)).toBe('2026-04-30');
  });

  it('uses the 29th of February in leap years', () => {
    expect(occurrenceDate(monthly('2028-01-31'), 2)).toBe('2028-02-29');
  });

  it('rolls monthly across years', () => {
    expect(occurrenceDate(monthly('2026-11-15'), 3)).toBe('2027-01-15');
  });

  it('moves a yearly 29 February to the 28th in non-leap years', () => {
    const rule = { frequency: { interval: 1, unit: RecurrenceUnit.YEAR }, startDate: '2028-02-29' };

    expect(occurrenceDate(rule, 2)).toBe('2029-02-28');
    expect(occurrenceDate(rule, 5)).toBe('2032-02-29');
  });

  it('adds 7 days for weekly and 14 for biweekly', () => {
    expect(
      occurrenceDate(
        { frequency: { interval: 1, unit: RecurrenceUnit.WEEK }, startDate: '2026-10-01' },
        5,
      ),
    ).toBe('2026-10-29');
    expect(
      occurrenceDate(
        { frequency: { interval: 2, unit: RecurrenceUnit.WEEK }, startDate: '2026-10-01' },
        3,
      ),
    ).toBe('2026-10-29');
  });
});

describe('occurrencesBetween', () => {
  it('lists every weekly occurrence of the month with its position', () => {
    const rule = { frequency: { interval: 1, unit: RecurrenceUnit.WEEK }, startDate: '2026-10-01' };

    expect(occurrencesBetween(rule, '2026-10-01', '2026-10-31')).toEqual([
      { date: '2026-10-01', k: 1 },
      { date: '2026-10-08', k: 2 },
      { date: '2026-10-15', k: 3 },
      { date: '2026-10-22', k: 4 },
      { date: '2026-10-29', k: 5 },
    ]);
  });

  it('starts at the first occurrence inside the range', () => {
    expect(occurrencesBetween(monthly('2026-01-05'), '2026-03-01', '2026-04-30')).toEqual([
      { date: '2026-03-05', k: 3 },
      { date: '2026-04-05', k: 4 },
    ]);
  });

  it('stops at the end date', () => {
    expect(
      occurrencesBetween(monthly('2026-01-05', '2026-02-05'), '2026-01-01', '2026-12-31'),
    ).toHaveLength(2);
  });

  it('returns nothing when the range is before the start', () => {
    expect(occurrencesBetween(monthly('2026-10-05'), '2026-01-01', '2026-09-30')).toEqual([]);
  });
});

describe('countUntil', () => {
  it('counts a year of monthly occurrences', () => {
    expect(countUntil(monthly('2026-10-05'), '2027-09-05')).toBe(12);
  });

  it('is 0 when the end is before the start', () => {
    expect(countUntil(monthly('2026-10-05'), '2026-10-04')).toBe(0);
  });
});

describe('lastDayOfMonth', () => {
  it.each([
    ['2026-10-17', '2026-10-31'],
    ['2026-02-03', '2026-02-28'],
    ['2028-02-03', '2028-02-29'],
  ])('%s -> %s', (date, expected) => {
    expect(lastDayOfMonth(date)).toBe(expected);
  });
});

describe('totalOccurrences', () => {
  it('is null without an end date', () => {
    expect(totalOccurrences(monthly('2026-10-05'), 1)).toBeNull();
  });

  it('continues the numbering of a split series', () => {
    expect(totalOccurrences(monthly('2026-05-05', '2026-12-05'), 5)).toBe(12);
  });
});

describe('planMaterialization', () => {
  const weekly: RecurrenceRule = {
    frequency: { interval: 1, unit: RecurrenceUnit.WEEK },
    startDate: '2026-10-01',
  };

  it('creates the rest of the month AND moves the series to the next occurrence', () => {
    const plan = planMaterialization({
      firstNumber: 1,
      horizon: '2026-10-31',
      lastGeneratedNumber: 1,
      rule: weekly,
      skippedNumbers: [],
    });

    expect(plan.occurrences.map((occurrence) => occurrence.date)).toEqual([
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
      '2026-10-29',
    ]);
    expect(plan).toMatchObject({
      lastGeneratedNumber: 5,
      nextOccurrenceDate: '2026-11-05',
      status: 'ACTIVE',
    });
  });

  it('catches up a long absence in one plan', () => {
    const plan = planMaterialization({
      firstNumber: 1,
      horizon: '2026-12-31',
      lastGeneratedNumber: 1,
      rule: monthly('2026-10-05'),
      skippedNumbers: [],
    });

    expect(plan.occurrences.map((occurrence) => occurrence.date)).toEqual([
      '2026-11-05',
      '2026-12-05',
    ]);
  });

  it('leaves skipped numbers out but still advances past them', () => {
    const plan = planMaterialization({
      firstNumber: 1,
      horizon: '2026-10-31',
      lastGeneratedNumber: 1,
      rule: weekly,
      skippedNumbers: [3],
    });

    expect(plan.occurrences.map((occurrence) => occurrence.number)).toEqual([2, 4, 5]);
    expect(plan.lastGeneratedNumber).toBe(5);
  });

  it('numbers a split series from its first number', () => {
    const plan = planMaterialization({
      firstNumber: 5,
      horizon: '2026-12-31',
      lastGeneratedNumber: 0,
      rule: monthly('2026-10-05'),
      skippedNumbers: [],
    });

    expect(plan.occurrences.map((occurrence) => occurrence.number)).toEqual([5, 6, 7]);
  });

  it('ends the series when the end date is reached', () => {
    const plan = planMaterialization({
      firstNumber: 1,
      horizon: '2026-12-31',
      lastGeneratedNumber: 0,
      rule: monthly('2026-10-05', '2026-11-05'),
      skippedNumbers: [],
    });

    expect(plan).toMatchObject({
      lastGeneratedNumber: 2,
      nextOccurrenceDate: null,
      status: 'ENDED',
    });
  });

  it('plans nothing before the series starts', () => {
    const plan = planMaterialization({
      firstNumber: 1,
      horizon: '2026-10-31',
      lastGeneratedNumber: 0,
      rule: monthly('2026-11-05'),
      skippedNumbers: [],
    });

    expect(plan).toMatchObject({
      lastGeneratedNumber: 0,
      nextOccurrenceDate: '2026-11-05',
      occurrences: [],
      status: 'ACTIVE',
    });
  });
});

describe('toOccurrenceRows', () => {
  const planned = [
    { date: '2026-10-05', k: 1, number: 1 },
    { date: '2026-11-05', k: 2, number: 2 },
  ];

  it('applies the paid flag to occurrence 1 only on account series', () => {
    expect(toOccurrenceRows(planned, undefined, true)).toEqual([
      { date: '2026-10-05', number: 1, paid: true },
      { date: '2026-11-05', number: 2, paid: false },
    ]);
  });

  it('creates account rows not paid by default', () => {
    expect(toOccurrenceRows(planned)[0].paid).toBe(false);
  });

  it('assigns the invoice by the closing day AND moves it past paid invoices', () => {
    const rows = toOccurrenceRows(planned, {
      closingDay: 10,
      paidMonths: new Set(['2026-10', '2026-11']),
    });

    expect(rows).toEqual([
      { date: '2026-10-05', invoiceMonth: '2026-12', number: 1 },
      { date: '2026-11-05', invoiceMonth: '2026-12', number: 2 },
    ]);
  });
});

describe('upcomingOccurrences', () => {
  it('returns the first occurrences on or after the date, up to the limit', () => {
    expect(upcomingOccurrences(monthly('2026-01-31'), '2026-03-01', 2)).toEqual([
      { date: '2026-03-31', k: 3 },
      { date: '2026-04-30', k: 4 },
    ]);
  });

  it('stops at the end date', () => {
    expect(upcomingOccurrences(monthly('2026-01-05', '2026-03-05'), '2026-02-01', 12)).toHaveLength(
      2,
    );
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('flexible interval (spec 114)', () => {
  const rule = (unit: RecurrenceUnit, interval: number, startDate: string, endDate?: string) => ({
    endDate,
    frequency: { interval, unit },
    startDate,
  });

  it('steps every N days from the start date', () => {
    expect(occurrenceDate(rule(RecurrenceUnit.DAY, 15, '2026-11-12'), 3)).toBe('2026-12-12');
  });

  it('steps every 3 weeks', () => {
    const weekly = rule(RecurrenceUnit.WEEK, 3, '2026-11-12');

    expect([2, 3, 4].map((k) => occurrenceDate(weekly, k))).toEqual([
      '2026-12-03',
      '2026-12-24',
      '2027-01-14',
    ]);
  });

  it('steps every 2 months and clamps the 31st', () => {
    const bimonthly = rule(RecurrenceUnit.MONTH, 2, '2027-01-31');

    expect([2, 3, 4].map((k) => occurrenceDate(bimonthly, k))).toEqual([
      '2027-03-31',
      '2027-05-31',
      '2027-07-31',
    ]);
  });

  it('keeps clamping monthly from the 31st', () => {
    const monthly31 = rule(RecurrenceUnit.MONTH, 1, '2027-01-31');

    expect([2, 3].map((k) => occurrenceDate(monthly31, k))).toEqual(['2027-02-28', '2027-03-31']);
  });

  it('steps every 2 years from 29 February', () => {
    const biennial = rule(RecurrenceUnit.YEAR, 2, '2028-02-29');

    expect([2, 3].map((k) => occurrenceDate(biennial, k))).toEqual(['2030-02-28', '2032-02-29']);
  });

  it('uses the maximum interval of each unit', () => {
    expect(occurrenceDate(rule(RecurrenceUnit.DAY, 365, '2026-01-01'), 2)).toBe('2027-01-01');
    expect(occurrenceDate(rule(RecurrenceUnit.WEEK, 52, '2026-01-01'), 2)).toBe('2026-12-31');
    expect(occurrenceDate(rule(RecurrenceUnit.MONTH, 24, '2026-01-15'), 2)).toBe('2028-01-15');
    expect(occurrenceDate(rule(RecurrenceUnit.YEAR, 10, '2026-01-15'), 2)).toBe('2036-01-15');
  });

  it('counts 7 occurrences every 2 months for a year (AC 1)', () => {
    const series = rule(RecurrenceUnit.MONTH, 2, '2026-11-12', '2027-11-12');

    expect(countUntil(series, '2027-11-12')).toBe(7);
    expect(totalOccurrences(series, 1)).toBe(7);
  });

  it('counts 6 occurrences every 15 days, the last on 2027-01-26 (AC 5)', () => {
    const series = rule(RecurrenceUnit.DAY, 15, '2026-11-12', '2027-01-26');
    const all = occurrencesBetween(series, '2026-11-12', '2027-01-26');

    expect(all).toHaveLength(6);
    expect(all[5].date).toBe('2027-01-26');
  });
});
