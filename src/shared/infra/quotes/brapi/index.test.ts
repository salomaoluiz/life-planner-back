import axios from 'axios';

import { QuoteSourceLimitError, QuoteSourceUnavailableError } from '../types';
import { BrapiQuotes } from './index';
import { envWith, mocks } from './index.mocks';

jest.mock('axios');

const getSpy = jest.mocked(axios.get);

beforeEach(() => {
  jest.clearAllMocks();
  getSpy.mockResolvedValue({ data: { results: [mocks.rawQuote] } });
});

describe('BrapiQuotes.getQuotes', () => {
  it('SHOULD request all symbols in one call with the token AND the 5s timeout', async () => {
    await new BrapiQuotes(envWith('your-token')).getQuotes(['itsa4', 'HGLG11']);

    expect(getSpy).toHaveBeenCalledWith('https://brapi.dev/api/quote/ITSA4,HGLG11', {
      params: { token: 'your-token' },
      timeout: 5000,
    });
  });

  it('SHOULD map the fields as decimal strings with the market timestamp', async () => {
    const [quote] = await new BrapiQuotes(envWith('your-token')).getQuotes(['ITSA4']);

    expect(quote).toEqual({
      changePercent: '0.48',
      dayHigh: '10.6',
      dayLow: '10.4',
      logoUrl: 'https://example.com/itsa4.svg',
      name: 'Itaúsa PN',
      previousClose: '10.48',
      price: '10.53',
      quotedAt: new Date('2026-11-04T16:00:00.000Z'),
      ticker: 'ITSA4',
    });
  });

  it('SHOULD skip results without a positive price AND return [] for no symbols', async () => {
    getSpy.mockResolvedValue({
      data: { results: [{ regularMarketPrice: 0, symbol: 'XPTO3' }, { regularMarketPrice: 1 }] },
    });
    const brapi = new BrapiQuotes(envWith('your-token'));

    expect(await brapi.getQuotes(['XPTO3'])).toEqual([]);
    expect(await brapi.getQuotes([])).toEqual([]);
  });

  it('SHOULD use the fetch time WHEN the API gives no (or an invalid) timestamp', async () => {
    getSpy.mockResolvedValue({
      data: {
        results: [
          { regularMarketPrice: 1, symbol: 'AAA1' },
          { regularMarketPrice: 1, regularMarketTime: 'nope', symbol: 'BBB1' },
        ],
      },
    });

    const quotes = await new BrapiQuotes(envWith('your-token')).getQuotes(['AAA1', 'BBB1']);

    expect(quotes.every((quote) => !Number.isNaN(quote.quotedAt.getTime()))).toBe(true);
    expect(quotes[0].name).toBeNull();
  });

  it('SHOULD throw QuoteSourceUnavailableError WHEN there is no token', async () => {
    await expect(new BrapiQuotes(envWith()).getQuotes(['ITSA4'])).rejects.toBeInstanceOf(
      QuoteSourceUnavailableError,
    );
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('SHOULD throw QuoteSourceLimitError WHEN brapi answers 429', async () => {
    getSpy.mockRejectedValue({ response: { status: 429 } });

    await expect(
      new BrapiQuotes(envWith('your-token')).getQuotes(['ITSA4']),
    ).rejects.toBeInstanceOf(QuoteSourceLimitError);
  });

  it('SHOULD refuse an invalid ticker before any call', async () => {
    await expect(new BrapiQuotes(envWith('your-token')).getQuotes(['a/b'])).rejects.toThrow(
      'Invalid ticker',
    );
  });
});

describe('BrapiQuotes.search', () => {
  it('SHOULD list the available symbols AND quote at most 10', async () => {
    const symbols = Array.from({ length: 12 }, (_, index) => `AAA${index}`);
    getSpy.mockResolvedValueOnce({ data: { stocks: [...symbols, 'bad symbol'] } });

    await new BrapiQuotes(envWith('your-token')).search(' aaa ');

    expect(getSpy.mock.calls[0]).toEqual([
      'https://brapi.dev/api/available',
      { params: { search: 'aaa', token: 'your-token' }, timeout: 5000 },
    ]);
    expect(getSpy.mock.calls[1][0]).toBe(
      `https://brapi.dev/api/quote/${symbols.slice(0, 10).join(',')}`,
    );
  });

  it('SHOULD return [] WHEN nothing matches', async () => {
    getSpy.mockResolvedValueOnce({ data: {} });

    expect(await new BrapiQuotes(envWith('your-token')).search('zzz')).toEqual([]);
  });
});

describe('BrapiQuotes.getDailyHistory', () => {
  it('SHOULD map the daily closes AND ignore incomplete rows', async () => {
    getSpy.mockResolvedValue({
      data: {
        results: [
          {
            historicalDataPrice: [
              { close: 10.5, date: 1730678400 },
              { close: null, date: 1730764800 },
            ],
          },
        ],
      },
    });

    const history = await new BrapiQuotes(envWith('your-token')).getDailyHistory('ITSA4', '3mo');

    expect(history).toEqual([{ close: '10.5', date: '2024-11-04' }]);
    expect(getSpy.mock.calls[0][1]).toMatchObject({ params: { interval: '1d', range: '3mo' } });
  });

  it('SHOULD return [] WHEN there are no results', async () => {
    getSpy.mockResolvedValue({ data: {} });

    expect(await new BrapiQuotes(envWith('your-token')).getDailyHistory('ITSA4', '3mo')).toEqual(
      [],
    );
  });
});
