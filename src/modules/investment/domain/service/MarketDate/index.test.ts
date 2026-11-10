import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

import { addDays, isWeekend, lastBusinessDay, marketDateOf } from './index';

describe('marketDateOf', () => {
  it('SHOULD use the market time zone WHEN the instant crosses midnight UTC', () => {
    // 01:30 UTC of Nov 5 is still Nov 4 in Sao Paulo (UTC-3) and in New York.
    const instant = new Date('2026-11-05T01:30:00Z');

    expect(marketDateOf(instant, QuoteMarket.B3)).toBe('2026-11-04');
    expect(marketDateOf(instant, QuoteMarket.US)).toBe('2026-11-04');
  });

  it('SHOULD keep the same date WHEN the instant is during the day', () => {
    expect(marketDateOf(new Date('2026-11-04T16:00:00Z'), QuoteMarket.B3)).toBe('2026-11-04');
  });
});

describe('lastBusinessDay', () => {
  it('SHOULD be today WHEN a weekday after the open', () => {
    expect(lastBusinessDay(QuoteMarket.B3, new Date('2026-11-04T16:00:00Z'))).toBe('2026-11-04');
  });

  it('SHOULD be yesterday WHEN a weekday before the open', () => {
    expect(lastBusinessDay(QuoteMarket.B3, new Date('2026-11-04T11:00:00Z'))).toBe('2026-11-03');
  });

  it('SHOULD be Friday WHEN Monday before the open, Saturday or Sunday', () => {
    expect(lastBusinessDay(QuoteMarket.B3, new Date('2026-11-09T11:00:00Z'))).toBe('2026-11-06');
    expect(lastBusinessDay(QuoteMarket.US, new Date('2026-11-07T18:00:00Z'))).toBe('2026-11-06');
    expect(lastBusinessDay(QuoteMarket.US, new Date('2026-11-08T18:00:00Z'))).toBe('2026-11-06');
  });
});

describe('calendar helpers', () => {
  it('SHOULD add days across a month AND detect weekends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(isWeekend('2026-11-07')).toBe(true);
    expect(isWeekend('2026-11-09')).toBe(false);
  });
});
