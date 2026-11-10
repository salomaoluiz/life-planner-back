import { Prisma } from '@db/client';

import { QuoteMapper } from './index';

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

describe('QuoteMapper', () => {
  it('SHOULD map a quote with optional decimals', () => {
    const quote = QuoteMapper.toQuote({
      change_percent: decimal('0.48'),
      currency: 'BRL',
      day_high: decimal('10.6'),
      day_low: null,
      fetched_at: new Date('2026-11-04T16:05:00Z'),
      id: 'q',
      last_error_at: null,
      logo_url: null,
      market: 'B3',
      missing_days: 0,
      name: 'Itausa PN',
      previous_close: null,
      price: decimal('10.53'),
      quoted_at: new Date('2026-11-04T16:00:00Z'),
      source: 'BRAPI',
      ticker: 'ITSA4',
      unavailable: false,
    });

    expect(quote.price.toString()).toBe('10.53');
    expect(quote.dayHigh?.toString()).toBe('10.6');
    expect(quote.dayLow).toBeNull();
    expect(quote.changePercent).toBe('0.4800');
    expect(quote.market).toBe('B3');
  });

  it('SHOULD map a null change percent', () => {
    const quote = QuoteMapper.toQuote({
      change_percent: null,
      currency: 'USD',
      day_high: null,
      day_low: null,
      fetched_at: new Date(),
      id: 'q',
      last_error_at: null,
      logo_url: null,
      market: 'US',
      missing_days: 0,
      name: null,
      previous_close: null,
      price: decimal('1'),
      quoted_at: new Date(),
      source: 'FINNHUB',
      ticker: 'AAPL',
      unavailable: false,
    });

    expect(quote.changePercent).toBeNull();
  });

  it('SHOULD map history and fx rows', () => {
    const history = QuoteMapper.toHistory({
      close: decimal('10.5'),
      created_at: new Date(),
      date: new Date('2026-11-04T00:00:00Z'),
      id: 'h',
      market: 'B3',
      source: 'BRAPI',
      ticker: 'ITSA4',
      updated_at: new Date(),
    });
    const fx = QuoteMapper.toFx({
      id: 'f',
      pair: 'USD-BRL',
      quoted_at: new Date('2026-11-04T16:00:00Z'),
      rate: decimal('5.5601'),
      source: 'BRAPI',
    });

    expect(history.date).toBe('2026-11-04');
    expect(history.close.toString()).toBe('10.5');
    expect(fx.rate).toBe('5.560100');
  });
});
