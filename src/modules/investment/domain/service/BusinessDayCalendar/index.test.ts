import { businessDays, isBusinessDay } from '@investment/domain/service/BusinessDayCalendar';

describe('BusinessDayCalendar', () => {
  it.each(['2026-02-16', '2026-02-17', '2026-04-03', '2026-06-04', '2026-11-20', '2026-01-01'])(
    'treats %s as a holiday',
    (date) => {
      expect(isBusinessDay(date)).toBe(false);
    },
  );

  it('treats weekends as non-business days', () => {
    expect(isBusinessDay('2026-11-14')).toBe(false);
    expect(isBusinessDay('2026-11-15')).toBe(false);
  });

  it('treats a regular weekday as a business day', () => {
    expect(isBusinessDay('2026-11-10')).toBe(true);
  });

  // 261 weekdays minus 12 weekday holidays (15/11 falls on a Sunday).
  it('counts 249 business days in 2026', () => {
    expect(businessDays('2026-01-01', '2027-01-01')).toBe(249);
  });

  it('counts [from, to): same day is zero and a single weekday is one', () => {
    expect(businessDays('2026-11-10', '2026-11-10')).toBe(0);
    expect(businessDays('2026-11-10', '2026-11-11')).toBe(1);
  });

  it('returns zero when to is before from', () => {
    expect(businessDays('2026-11-11', '2026-11-10')).toBe(0);
  });

  it('works for the edge years 2000 and 2100', () => {
    expect(businessDays('2000-01-01', '2001-01-01')).toBeGreaterThan(240);
    expect(businessDays('2100-01-01', '2101-01-01')).toBeGreaterThan(240);
  });

  it('skips the Easter-based holidays of 2000 (Carnival 07/03, Good Friday 21/04)', () => {
    expect(isBusinessDay('2000-03-07')).toBe(false);
    expect(isBusinessDay('2000-04-21')).toBe(false);
  });
});
