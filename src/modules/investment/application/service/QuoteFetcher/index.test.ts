import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { QuoteSourceLimitError, QuoteSourceUnavailableError } from '@shared/infra/quotes/types';

import { sortOldestFirst } from './index';
import { mocks, setup, spies } from './index.mocks';

function tracked(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    fetchedAt: null,
    market: QuoteMarket.B3,
    ticker: `AAA${String(index).padStart(2, '0')}`,
  }));
}

describe('sortOldestFirst', () => {
  it('SHOULD put never-fetched first, then the oldest, ties by ticker', () => {
    const sorted = sortOldestFirst([
      { fetchedAt: new Date('2026-11-04T10:00:00Z'), market: QuoteMarket.B3, ticker: 'BBB' },
      { fetchedAt: new Date('2026-11-04T09:00:00Z'), market: QuoteMarket.B3, ticker: 'CCC' },
      { fetchedAt: null, market: QuoteMarket.B3, ticker: 'ZZZ' },
      { fetchedAt: null, market: QuoteMarket.B3, ticker: 'AAA' },
    ]);

    expect(sorted.map((symbol) => symbol.ticker)).toEqual(['AAA', 'ZZZ', 'CCC', 'BBB']);
  });
});

describe('fetchMarket B3', () => {
  it('SHOULD send 45 symbols in 3 batches of at most 20 AND save every quote with its history row', async () => {
    spies.brapi.getQuotes.mockImplementation(async (tickers: string[]) =>
      tickers.map((ticker) => mocks.result(ticker)),
    );

    const outcome = await setup.fetchMarket(QuoteMarket.B3, tracked(45), {
      closeRun: false,
      now: mocks.now,
    });

    expect(spies.brapi.getQuotes.mock.calls.map(([batch]) => batch.length)).toEqual([20, 20, 5]);
    expect(outcome).toEqual({ failed: [], fetched: 45 });
    expect(spies.repository.saveQuotes).toHaveBeenCalledTimes(3);
    expect(spies.repository.saveQuotes.mock.calls[0][0][0]).toMatchObject({
      currency: 'BRL',
      price: '10.53000000',
      source: 'BRAPI',
    });
    expect(spies.repository.saveHistory.mock.calls[0][0][0]).toMatchObject({
      date: '2026-11-04',
      market: 'B3',
    });
  });

  it('SHOULD stop at a 429: only that batch gets last_error_at AND the 3rd batch is not sent', async () => {
    spies.brapi.getQuotes
      .mockImplementationOnce(async (tickers: string[]) => tickers.map((t) => mocks.result(t)))
      .mockRejectedValueOnce(new QuoteSourceLimitError('429'));

    const outcome = await setup.fetchMarket(QuoteMarket.B3, tracked(45), {
      closeRun: false,
      now: mocks.now,
    });

    expect(spies.brapi.getQuotes).toHaveBeenCalledTimes(2);
    expect(outcome.fetched).toBe(20);
    expect(outcome.failed).toHaveLength(20);
    expect(spies.repository.markQuoteErrors).toHaveBeenCalledTimes(1);
    expect(spies.repository.markQuoteErrors.mock.calls[0][0]).toHaveLength(20);
    expect(spies.logger.log).toHaveBeenCalledTimes(1);
  });

  it('SHOULD order the next run so the skipped batches go first', async () => {
    const first = tracked(3).map((symbol, index) => ({
      ...symbol,
      fetchedAt: index === 0 ? new Date('2026-11-04T16:05:00Z') : null,
    }));
    spies.brapi.getQuotes.mockResolvedValue([]);

    await setup.fetchMarket(QuoteMarket.B3, first, { closeRun: false, now: mocks.now });

    expect(spies.brapi.getQuotes.mock.calls[0][0]).toEqual(['AAA01', 'AAA02', 'AAA00']);
  });

  it('SHOULD only log WHEN the token is missing (no error marks, no throw)', async () => {
    spies.brapi.getQuotes.mockRejectedValue(new QuoteSourceUnavailableError('brapi'));

    const outcome = await setup.fetchMarket(QuoteMarket.B3, tracked(2), {
      closeRun: false,
      now: mocks.now,
    });

    expect(outcome).toEqual({ failed: [], fetched: 0 });
    expect(spies.repository.markQuoteErrors).not.toHaveBeenCalled();
    expect(spies.logger.log).toHaveBeenCalledTimes(1);
  });

  it('SHOULD mark missing days only on the close run AND ignore tickers nobody asked for', async () => {
    spies.brapi.getQuotes.mockResolvedValue([mocks.result('AAA00'), mocks.result('OTHER')]);

    await setup.fetchMarket(QuoteMarket.B3, tracked(2), { closeRun: false, now: mocks.now });
    expect(spies.repository.markMissing).not.toHaveBeenCalled();

    await setup.fetchMarket(QuoteMarket.B3, tracked(2), { closeRun: true, now: mocks.now });

    expect(spies.repository.markMissing).toHaveBeenCalledWith([{ market: 'B3', ticker: 'AAA01' }]);
    expect(spies.repository.saveQuotes.mock.calls[0][0]).toHaveLength(1);
  });

  it('SHOULD not save anything WHEN the source returns nothing', async () => {
    spies.brapi.getQuotes.mockResolvedValue([]);

    await setup.fetchMarket(QuoteMarket.B3, tracked(1), { closeRun: false, now: mocks.now });

    expect(spies.repository.saveQuotes).not.toHaveBeenCalled();
  });

  it('SHOULD keep the market date of the quote (a holiday repeats the previous day, no new row)', async () => {
    spies.brapi.getQuotes.mockResolvedValue([
      mocks.result('AAA00', { quotedAt: new Date('2026-11-03T20:55:00Z') }),
    ]);

    await setup.fetchMarket(QuoteMarket.B3, tracked(1), { closeRun: true, now: mocks.now });

    expect(spies.repository.saveHistory.mock.calls[0][0][0].date).toBe('2026-11-03');
  });
});

describe('fetchMarket US', () => {
  it('SHOULD fetch one symbol per call from Finnhub in USD', async () => {
    spies.finnhub.getQuotes.mockImplementation(async (tickers: string[]) =>
      tickers.map((ticker) => mocks.result(ticker)),
    );
    const symbols = [
      { fetchedAt: null, market: QuoteMarket.US, ticker: 'AAPL' },
      { fetchedAt: null, market: QuoteMarket.US, ticker: 'VOO' },
    ];

    await setup.fetchMarket(QuoteMarket.US, symbols, { closeRun: false, now: mocks.now });

    expect(spies.finnhub.getQuotes.mock.calls).toEqual([[['AAPL']], [['VOO']]]);
    expect(spies.repository.saveQuotes.mock.calls[0][0][0]).toMatchObject({
      currency: 'USD',
      source: 'FINNHUB',
    });
  });

  it('SHOULD keep the previous quote WHEN Finnhub times out (one warning, no throw)', async () => {
    spies.finnhub.getQuotes.mockRejectedValue(new QuoteSourceLimitError('timeout'));

    const outcome = await setup.fetchMarket(
      QuoteMarket.US,
      [{ fetchedAt: null, market: QuoteMarket.US, ticker: 'AAPL' }],
      { closeRun: false, now: mocks.now },
    );

    expect(outcome.failed).toEqual(['AAPL']);
    expect(spies.repository.saveQuotes).not.toHaveBeenCalled();
    expect(spies.logger.log).toHaveBeenCalledTimes(1);
  });
});

describe('fetchFx', () => {
  it('SHOULD save the latest rate AND the daily history row', async () => {
    spies.fx.getUsdBrl.mockResolvedValue({
      quotedAt: new Date('2026-11-04T16:00:00Z'),
      rate: '5.560100',
      source: 'BRAPI',
    });

    const fx = await setup.fetchFx(mocks.now);

    expect(fx).toMatchObject({ pair: 'USD-BRL', rate: '5.560100' });
    expect(spies.repository.saveFx).toHaveBeenCalled();
    expect(spies.repository.saveFxHistory).toHaveBeenCalledWith([
      { date: '2026-11-04', pair: 'USD-BRL', rate: '5.560100', source: 'BRAPI' },
    ]);
  });

  it('SHOULD return null AND log WHEN the source fails', async () => {
    spies.fx.getUsdBrl.mockRejectedValue(new Error('down'));

    expect(await setup.fetchFx(mocks.now)).toBeNull();
    expect(spies.logger.log).toHaveBeenCalledTimes(1);
    expect(spies.repository.saveFx).not.toHaveBeenCalled();
  });
});
