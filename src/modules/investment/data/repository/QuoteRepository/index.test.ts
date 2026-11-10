import { Decimal8 } from '@shared/infra/decimal';

import { mocks, setup, spies } from './index.mocks';

describe('QuoteRepository reads', () => {
  it('SHOULD map the quotes AND the fx rate', async () => {
    spies.findQuotes.mockResolvedValue([mocks.quoteRow]);
    spies.findFx.mockResolvedValueOnce({
      pair: 'USD-BRL',
      quoted_at: new Date('2026-11-04T16:00:00Z'),
      rate: mocks.decimal('5.5601'),
      source: 'BRAPI',
    });
    spies.findFx.mockResolvedValueOnce(null);

    expect(
      (await setup.findQuotes([{ market: 'B3' as never, ticker: 'ITSA4' }]))[0].price.toString(),
    ).toBe('10.53');
    expect((await setup.findFx('USD-BRL'))?.rate).toBe('5.560100');
    expect(await setup.findFx('XXX-YYY')).toBeUndefined();
  });

  it('SHOULD join the tracked symbols with their last fetch (null when never fetched)', async () => {
    spies.findTrackedSymbols.mockResolvedValue([
      { market: 'B3', ticker: 'ITSA4' },
      { market: 'US', ticker: 'AAPL' },
    ]);
    spies.findQuotes.mockResolvedValue([mocks.quoteRow]);

    const tracked = await setup.findTrackedSymbols('2026-10-10');

    expect(tracked).toEqual([
      { fetchedAt: new Date('2026-11-04T16:05:00Z'), market: 'B3', ticker: 'ITSA4' },
      { fetchedAt: null, market: 'US', ticker: 'AAPL' },
    ]);
    expect(spies.findTrackedSymbols).toHaveBeenCalledWith(new Date('2026-10-10T00:00:00.000Z'));
  });

  it('SHOULD map history, fx history AND the fx on or before a date', async () => {
    spies.findHistory.mockResolvedValue([
      {
        close: mocks.decimal('10.5'),
        date: new Date('2026-11-04T00:00:00Z'),
        market: 'B3',
        source: 'BRAPI',
        ticker: 'ITSA4',
      },
    ]);
    spies.findFxHistory.mockResolvedValue([
      {
        date: new Date('2026-11-04T00:00:00Z'),
        pair: 'USD-BRL',
        rate: mocks.decimal('5.5'),
        source: 'BRAPI',
      },
    ]);
    spies.findFxOnOrBefore.mockResolvedValueOnce({ rate: mocks.decimal('5.5') });
    spies.findFxOnOrBefore.mockResolvedValueOnce(null);

    expect(
      (await setup.findHistory('B3' as never, 'ITSA4', '2026-01-01', '2026-11-04'))[0].date,
    ).toBe('2026-11-04');
    expect((await setup.findFxHistory('USD-BRL', '2026-01-01', '2026-11-04'))[0].rate).toBe(
      '5.500000',
    );
    expect(await setup.findFxOnOrBefore('USD-BRL', '2026-11-04')).toBe('5.500000');
    expect(await setup.findFxOnOrBefore('USD-BRL', '2020-01-01')).toBeUndefined();
  });
});

describe('QuoteRepository writes', () => {
  it('SHOULD pass quotes, history, fx and errors to the datasource with datasource names', async () => {
    const fetchedAt = new Date('2026-11-04T16:05:00Z');

    await setup.saveQuotes(
      [
        {
          changePercent: '0.48',
          currency: 'BRL',
          dayHigh: null,
          dayLow: null,
          logoUrl: null,
          market: 'B3' as never,
          name: null,
          previousClose: null,
          price: '10.53',
          quotedAt: fetchedAt,
          source: 'BRAPI' as never,
          ticker: 'ITSA4',
        },
      ],
      fetchedAt,
    );
    await setup.saveHistory([
      {
        close: Decimal8.parse('10.5'),
        date: '2026-11-04',
        market: 'B3' as never,
        source: 'BRAPI' as never,
        ticker: 'ITSA4',
      },
    ]);
    await setup.saveFxHistory([
      { date: '2026-11-04', pair: 'USD-BRL', rate: '5.5', source: 'BRAPI' },
    ]);
    await setup.saveFx({ pair: 'USD-BRL', quotedAt: fetchedAt, rate: '5.5', source: 'BRAPI' });
    await setup.markMissing([{ market: 'B3' as never, ticker: 'ITSA4' }]);
    await setup.markQuoteErrors([{ market: 'B3' as never, ticker: 'ITSA4' }], fetchedAt);

    expect(spies.saveQuotes.mock.calls[0][0][0]).toMatchObject({
      change_percent: '0.48',
      quoted_at: fetchedAt,
    });
    expect(spies.saveHistory.mock.calls[0][0][0]).toMatchObject({
      close: '10.50000000',
      date: new Date('2026-11-04T00:00:00.000Z'),
    });
    expect(spies.saveFxHistory).toHaveBeenCalled();
    expect(spies.saveFx).toHaveBeenCalledWith({
      pair: 'USD-BRL',
      quoted_at: fetchedAt,
      rate: '5.5',
      source: 'BRAPI',
    });
    expect(spies.markMissing).toHaveBeenCalled();
    expect(spies.markQuoteErrors).toHaveBeenCalled();
  });

  it('SHOULD delegate hasHistory AND runExclusive', async () => {
    spies.hasHistory.mockResolvedValue(true);
    spies.runExclusive.mockResolvedValue(false);

    expect(await setup.hasHistory('B3' as never, 'ITSA4')).toBe(true);
    expect(await setup.runExclusive(1, jest.fn())).toBe(false);
  });
});
