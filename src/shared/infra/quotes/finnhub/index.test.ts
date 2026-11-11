import axios from 'axios';

import { QuoteSourceLimitError, QuoteSourceUnavailableError } from '../types';
import { FinnhubQuotes } from './index';
import { envWith, mocks } from './index.mocks';

jest.mock('axios');

const getSpy = jest.mocked(axios.get);

beforeEach(() => {
  jest.clearAllMocks();
  getSpy.mockResolvedValue({ data: mocks.rawQuote });
});

describe('FinnhubQuotes.getQuotes', () => {
  it('SHOULD call /quote once per symbol AND map c, dp, h, l, pc and t', async () => {
    const quotes = await new FinnhubQuotes(envWith('your-token')).getQuotes(['aapl', 'VOO']);

    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(getSpy.mock.calls[0]).toEqual([
      'https://finnhub.io/api/v1/quote',
      { params: { symbol: 'AAPL', token: 'your-token' }, timeout: 5000 },
    ]);
    expect(quotes[0]).toEqual({
      changePercent: '1.24',
      dayHigh: '232.1',
      dayLow: '228.9',
      logoUrl: null,
      name: null,
      previousClose: '228.57',
      price: '231.4',
      quotedAt: new Date(1762272000 * 1000),
      ticker: 'AAPL',
    });
  });

  it('SHOULD skip a symbol Finnhub answers with price 0 (unknown symbol)', async () => {
    getSpy.mockResolvedValue({ data: { c: 0, t: 0 } });

    expect(await new FinnhubQuotes(envWith('your-token')).getQuotes(['XYZW'])).toEqual([]);
  });

  it('SHOULD throw QuoteSourceUnavailableError WHEN there is no token', async () => {
    await expect(new FinnhubQuotes(envWith()).getQuotes(['AAPL'])).rejects.toBeInstanceOf(
      QuoteSourceUnavailableError,
    );
  });

  it('SHOULD throw QuoteSourceLimitError WHEN Finnhub answers 429', async () => {
    getSpy.mockRejectedValue({ response: { status: 429 } });

    await expect(
      new FinnhubQuotes(envWith('your-token')).getQuotes(['AAPL']),
    ).rejects.toBeInstanceOf(QuoteSourceLimitError);
  });
});

describe('FinnhubQuotes.search', () => {
  it('SHOULD quote the matching symbols AND take the name from the search', async () => {
    getSpy
      .mockResolvedValueOnce({
        data: { result: [{ description: 'APPLE INC', symbol: 'AAPL' }, { symbol: 'AAPL.SW' }] },
      })
      .mockResolvedValueOnce({ data: mocks.rawQuote });

    const results = await new FinnhubQuotes(envWith('your-token')).search('appl');

    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ name: 'APPLE INC', ticker: 'AAPL' });
  });

  it('SHOULD return [] WHEN the search finds nothing', async () => {
    getSpy.mockResolvedValueOnce({ data: {} });

    expect(await new FinnhubQuotes(envWith('your-token')).search('zzz')).toEqual([]);
  });
});

describe('FinnhubQuotes.getIncomeEvents (spec 107)', () => {
  it('SHOULD map the dividends of one symbol as gross per share in USD', async () => {
    getSpy.mockResolvedValue({
      data: [
        { amount: 0.25, currency: 'USD', date: '2026-11-10', payDate: '2026-11-17' },
        { amount: 0, date: '2026-08-10' },
        { amount: 1 },
      ],
    });

    const events = await new FinnhubQuotes(envWith('your-token')).getIncomeEvents('aapl');

    expect(getSpy).toHaveBeenCalledWith(
      'https://finnhub.io/api/v1/stock/dividend',
      expect.objectContaining({
        params: expect.objectContaining({ symbol: 'AAPL', token: 'your-token' }),
      }),
    );
    expect(events).toEqual([
      {
        amountPerUnit: '0.25',
        currency: 'USD',
        exDate: '2026-11-10',
        paymentDate: '2026-11-17',
        ticker: 'AAPL',
        type: 'DIVIDEND',
      },
    ]);
  });

  it('SHOULD accept the `{ data }` envelope', async () => {
    getSpy.mockResolvedValue({ data: { data: [{ amount: 1, date: '2026-11-10' }] } });

    const [event] = await new FinnhubQuotes(envWith('your-token')).getIncomeEvents('AAPL');

    expect(event).toMatchObject({ currency: 'USD', paymentDate: null });
  });

  it('SHOULD return [] WHEN the plan has no dividends endpoint (403)', async () => {
    getSpy.mockRejectedValue(Object.assign(new Error('Forbidden'), { response: { status: 403 } }));

    expect(await new FinnhubQuotes(envWith('your-token')).getIncomeEvents('AAPL')).toEqual([]);
  });

  it('SHOULD throw WHEN the token is missing OR the source is rate limited', async () => {
    await expect(new FinnhubQuotes(envWith()).getIncomeEvents('AAPL')).rejects.toBeInstanceOf(
      QuoteSourceUnavailableError,
    );

    getSpy.mockRejectedValue({ response: { status: 429 } });

    await expect(
      new FinnhubQuotes(envWith('your-token')).getIncomeEvents('AAPL'),
    ).rejects.toBeInstanceOf(QuoteSourceLimitError);
  });
});
