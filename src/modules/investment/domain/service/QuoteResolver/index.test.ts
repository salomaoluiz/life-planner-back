import { QuoteEntity } from '@investment/domain/entity/QuoteEntity';
import { QuoteMarket, QuoteSource } from '@investment/domain/enum/QuoteMarket';
import { Decimal8 } from '@shared/infra/decimal';

import { isStale, marketOfClass, resolvePrice } from './index';

function manual(date: string) {
  return { date, unitPrice: Decimal8.parse('4.10') };
}
function quote(overrides: Partial<QuoteEntity> = {}): QuoteEntity {
  return {
    changePercent: null,
    currency: 'BRL',
    dayHigh: null,
    dayLow: null,
    fetchedAt: new Date('2026-11-04T16:05:00Z'),
    lastErrorAt: null,
    logoUrl: null,
    market: QuoteMarket.B3,
    missingDays: 0,
    name: null,
    previousClose: null,
    price: Decimal8.parse('10.53'),
    quotedAt: new Date('2026-11-04T16:00:00Z'),
    source: QuoteSource.BRAPI,
    ticker: 'ITSA4',
    unavailable: false,
    ...overrides,
  };
}

describe('resolvePrice', () => {
  it('SHOULD pick the quote WHEN there is no valuation OR it is older', () => {
    expect(resolvePrice({ quote: quote(), valuation: null })).toMatchObject({
      date: '2026-11-04',
      source: 'QUOTE',
    });
    expect(resolvePrice({ quote: quote(), valuation: manual('2026-11-03') })?.source).toBe('QUOTE');
  });

  it('SHOULD pick the manual valuation WHEN it is on the quote date (manual wins) OR newer', () => {
    expect(resolvePrice({ quote: quote(), valuation: manual('2026-11-04') })?.source).toBe(
      'MANUAL',
    );
    expect(resolvePrice({ quote: quote(), valuation: manual('2026-11-05') })?.source).toBe(
      'MANUAL',
    );
  });

  it('SHOULD pick the valuation WHEN there is no quote, AND null WHEN neither exists', () => {
    expect(resolvePrice({ quote: null, valuation: manual('2026-10-28') })).toMatchObject({
      date: '2026-10-28',
      source: 'MANUAL',
    });
    expect(resolvePrice({ quote: null, valuation: null })).toBeNull();
  });
});

describe('isStale', () => {
  it('SHOULD be stale WHEN the market date is older than the last business day', () => {
    expect(isStale(quote(), '2026-11-05')).toBe(true);
    expect(isStale(quote(), '2026-11-04')).toBe(false);
  });

  it('SHOULD be stale WHEN the last error is newer than the last fetch', () => {
    expect(isStale(quote({ lastErrorAt: new Date('2026-11-04T17:05:00Z') }), '2026-11-04')).toBe(
      true,
    );
    expect(isStale(quote({ lastErrorAt: new Date('2026-11-04T16:00:00Z') }), '2026-11-04')).toBe(
      false,
    );
  });
});

describe('marketOfClass', () => {
  it.each([
    ['BR_STOCK', QuoteMarket.B3],
    ['BR_REIT', QuoteMarket.B3],
    ['FOREIGN_STOCK', QuoteMarket.US],
    ['FIXED_INCOME', null],
    ['PRIVATE', null],
  ])('SHOULD map %p to %p', (assetClass, market) => {
    expect(marketOfClass(assetClass)).toBe(market);
  });
});
