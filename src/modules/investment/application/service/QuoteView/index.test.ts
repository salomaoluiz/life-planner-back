import { quoteFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { Decimal8 } from '@shared/infra/decimal';

import { toQuoteView } from './index';

describe('toQuoteView', () => {
  it('SHOULD map decimals to strings AND flag stale by the last business day of the market', () => {
    const quote = quoteFixture({ dayLow: null, previousClose: Decimal8.parse('10.48') });

    const fresh = toQuoteView(quote, new Date('2026-11-04T18:00:00Z'));
    const old = toQuoteView(quote, new Date('2026-11-05T18:00:00Z'));

    expect(fresh).toMatchObject({
      dayHigh: '10.6',
      dayLow: null,
      previousClose: '10.48',
      price: '10.53',
      stale: false,
      ticker: 'ITSA4',
    });
    expect(old.stale).toBe(true);
  });

  it('SHOULD be stale WHEN the caller says the refresh failed', () => {
    expect(toQuoteView(quoteFixture(), new Date('2026-11-04T18:00:00Z'), true).stale).toBe(true);
  });
});
