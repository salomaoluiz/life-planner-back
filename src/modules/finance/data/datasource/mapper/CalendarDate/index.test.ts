import { fromCalendarDate, toCalendarDate } from './index';

describe('calendar date helpers', () => {
  it.each(['2026-10-03', '2026-12-31', '2026-01-01', '2024-02-29'])(
    'SHOULD round-trip %s with no timezone drift',
    (value) => {
      expect(toCalendarDate(fromCalendarDate(value))).toBe(value);
    },
  );

  it('SHOULD build a UTC-midnight Date (what Postgres `date` columns return)', () => {
    expect(fromCalendarDate('2026-10-03').toISOString()).toBe('2026-10-03T00:00:00.000Z');
  });

  it('SHOULD read the UTC calendar day of a Date, independent of the process timezone', () => {
    expect(toCalendarDate(new Date('2026-10-03T00:00:00.000Z'))).toBe('2026-10-03');
    expect(toCalendarDate(new Date('2026-10-03T23:59:59.999Z'))).toBe('2026-10-03');
  });
});
