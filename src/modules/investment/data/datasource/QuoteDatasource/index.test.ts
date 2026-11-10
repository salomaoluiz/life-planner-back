import { mocks, setup, spies } from './index.mocks';

const key = { market: 'B3', ticker: 'ITSA4' };

describe('QuoteDatasource reads', () => {
  it('SHOULD skip the query WHEN there are no keys', async () => {
    expect(await setup.findQuotes([])).toEqual([]);
    expect(spies.quoteFindMany).not.toHaveBeenCalled();
  });

  it('SHOULD find the quotes of the given symbols in ONE query', async () => {
    spies.quoteFindMany.mockResolvedValue([{ id: 'q' }]);

    expect(await setup.findQuotes([key, { market: 'US', ticker: 'AAPL' }])).toEqual([{ id: 'q' }]);
    expect(spies.quoteFindMany).toHaveBeenCalledWith({
      where: { OR: [key, { market: 'US', ticker: 'AAPL' }] },
    });
  });

  it('SHOULD read the tracked symbols with raw SQL', async () => {
    spies.queryRaw.mockResolvedValue([key]);

    expect(await setup.findTrackedSymbols(new Date('2026-10-10'))).toEqual([key]);
  });

  it('SHOULD read fx rate, fx history and price history', async () => {
    spies.fxFindUnique.mockResolvedValue({ pair: 'USD-BRL' });
    spies.fxHistoryFindMany.mockResolvedValue([]);
    spies.fxHistoryFindFirst.mockResolvedValue({ rate: mocks.decimal('5.5') });
    spies.historyFindMany.mockResolvedValue([]);
    const from = new Date('2026-01-01');
    const to = new Date('2026-11-01');

    expect(await setup.findFx('USD-BRL')).toEqual({ pair: 'USD-BRL' });
    await setup.findFxHistory('USD-BRL', from, to);
    await setup.findFxOnOrBefore('USD-BRL', to);
    await setup.findHistory('B3', 'ITSA4', from, to);

    expect(spies.fxHistoryFindMany).toHaveBeenCalledWith({
      orderBy: { date: 'asc' },
      where: { date: { gte: from, lte: to }, pair: 'USD-BRL' },
    });
    expect(spies.fxHistoryFindFirst).toHaveBeenCalledWith({
      orderBy: { date: 'desc' },
      where: { date: { lte: to }, pair: 'USD-BRL' },
    });
    expect(spies.historyFindMany).toHaveBeenCalledWith({
      orderBy: { date: 'asc' },
      where: { date: { gte: from, lte: to }, market: 'B3', ticker: 'ITSA4' },
    });
  });

  it('SHOULD tell whether a symbol has history', async () => {
    spies.historyFindFirst.mockResolvedValueOnce({ id: 'h' }).mockResolvedValueOnce(null);

    expect(await setup.hasHistory('B3', 'ITSA4')).toBe(true);
    expect(await setup.hasHistory('B3', 'XPTO3')).toBe(false);
  });
});

describe('QuoteDatasource writes', () => {
  it('SHOULD upsert each quote clearing error, missing days AND unavailable', async () => {
    const fetchedAt = new Date('2026-11-04T16:05:00Z');

    await setup.saveQuotes([mocks.upsert], fetchedAt);

    expect(spies.quoteUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          fetched_at: fetchedAt,
          last_error_at: null,
          missing_days: 0,
          unavailable: false,
        }),
        where: { market_ticker: { market: 'B3', ticker: 'ITSA4' } },
      }),
    );
  });

  it('SHOULD do nothing WHEN there is nothing to save', async () => {
    await setup.saveQuotes([], new Date());
    await setup.saveHistory([]);
    await setup.saveFxHistory([]);
    await setup.markMissing([]);
    await setup.markQuoteErrors([], new Date());

    expect(spies.quoteUpsert).not.toHaveBeenCalled();
    expect(spies.quoteUpdateMany).not.toHaveBeenCalled();
  });

  it('SHOULD upsert history by (market, ticker, date) AND fx history by (pair, date)', async () => {
    const date = new Date('2026-11-04');

    await setup.saveHistory([
      { close: '10.5', date, market: 'B3', source: 'BRAPI', ticker: 'ITSA4' },
    ]);
    await setup.saveFxHistory([{ date, pair: 'USD-BRL', rate: '5.5', source: 'BRAPI' }]);
    await setup.saveFx({ pair: 'USD-BRL', quoted_at: date, rate: '5.5', source: 'BRAPI' });

    expect(spies.historyUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { market_ticker_date: { date, market: 'B3', ticker: 'ITSA4' } },
      }),
    );
    expect(spies.fxHistoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pair_date: { date, pair: 'USD-BRL' } } }),
    );
    expect(spies.fxUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pair: 'USD-BRL' } }),
    );
  });

  it('SHOULD add a missing day AND flag unavailable from 5 days', async () => {
    await setup.markMissing([key]);

    expect(spies.quoteUpdateMany).toHaveBeenNthCalledWith(1, {
      data: { missing_days: { increment: 1 } },
      where: { OR: [key] },
    });
    expect(spies.quoteUpdateMany).toHaveBeenNthCalledWith(2, {
      data: { unavailable: true },
      where: { missing_days: { gte: 5 }, OR: [key] },
    });
  });

  it('SHOULD record the error time of failed symbols', async () => {
    const at = new Date('2026-11-04T17:05:00Z');

    await setup.markQuoteErrors([key], at);

    expect(spies.quoteUpdateMany).toHaveBeenCalledWith({
      data: { last_error_at: at },
      where: { OR: [key] },
    });
  });
});

describe('QuoteDatasource.runExclusive', () => {
  it('SHOULD run the function WHEN the advisory lock is free', async () => {
    spies.queryRaw.mockResolvedValue([{ locked: true }]);
    const fn = jest.fn().mockResolvedValue(undefined);

    expect(await setup.runExclusive(7, fn)).toBe(true);
    expect(fn).toHaveBeenCalled();
  });

  it('SHOULD skip the run WHEN another instance holds the lock', async () => {
    spies.queryRaw.mockResolvedValue([{ locked: false }]);
    const fn = jest.fn();

    expect(await setup.runExclusive(7, fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});
