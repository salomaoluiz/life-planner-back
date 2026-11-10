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
