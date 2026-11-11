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

describe('BrapiQuotes.getQuotes on the free plan (1 ticker per request)', () => {
  const exceeded = Object.assign(new Error('400'), {
    response: {
      data: {
        code: 'QUOTES_PER_REQUEST_EXCEEDED',
        message: 'Seu plano permite no máximo 1 ativo(s) por requisição. Você enviou 2.',
      },
      status: 400,
    },
  });

  it('SHOULD learn the limit from the 400 AND request the symbols one by one', async () => {
    getSpy.mockRejectedValueOnce(exceeded);
    getSpy.mockImplementation(async (url: string) => ({
      data: { results: [{ ...mocks.rawQuote, symbol: url.split('/quote/')[1] }] },
    }));
    const brapi = new BrapiQuotes(envWith('your-token'));

    const quotes = await brapi.getQuotes(['ITSA4', 'HGLG11']);

    expect(quotes.map((quote) => quote.ticker)).toEqual(['ITSA4', 'HGLG11']);
    expect(getSpy.mock.calls.map(([url]) => url)).toEqual([
      'https://brapi.dev/api/quote/ITSA4,HGLG11',
      'https://brapi.dev/api/quote/ITSA4',
      'https://brapi.dev/api/quote/HGLG11',
    ]);

    getSpy.mockClear();
    await brapi.getQuotes(['A1', 'B1', 'C1']);

    expect(getSpy).toHaveBeenCalledTimes(3);
  });

  it('SHOULD rethrow other 400 errors AND a limit that does not help', async () => {
    getSpy.mockRejectedValueOnce(
      Object.assign(new Error('400'), {
        response: { data: { code: 'INVALID_RANGE' }, status: 400 },
      }),
    );
    await expect(
      new BrapiQuotes(envWith('your-token')).getQuotes(['A1', 'B1']),
    ).rejects.toBeDefined();

    getSpy.mockRejectedValueOnce(exceeded);
    await expect(new BrapiQuotes(envWith('your-token')).getQuotes(['A1'])).rejects.toBeDefined();
  });

  it('SHOULD default to 1 WHEN the message has no number', async () => {
    getSpy.mockRejectedValueOnce(
      Object.assign(new Error('400'), {
        response: { data: { code: 'QUOTES_PER_REQUEST_EXCEEDED', message: 'x' }, status: 400 },
      }),
    );
    getSpy.mockResolvedValue({ data: { results: [mocks.rawQuote] } });

    await new BrapiQuotes(envWith('your-token')).getQuotes(['A1', 'B1']);

    expect(getSpy).toHaveBeenCalledTimes(3);
  });
});

describe('BrapiQuotes.getQuotes with an unknown ticker (404)', () => {
  function notFound() {
    return Object.assign(new Error('404'), { response: { data: {}, status: 404 } });
  }

  it('SHOULD return [] for a single unknown ticker', async () => {
    getSpy.mockRejectedValue(notFound());

    expect(await new BrapiQuotes(envWith('your-token')).getQuotes(['XYZW9'])).toEqual([]);
  });

  it('SHOULD still return the known tickers WHEN one of a batch is unknown', async () => {
    getSpy.mockRejectedValueOnce(notFound());
    getSpy.mockImplementation(async (url: string) => {
      if (url.endsWith('XYZW9')) {
        throw notFound();
      }

      return { data: { results: [{ ...mocks.rawQuote, symbol: url.split('/quote/')[1] }] } };
    });

    const quotes = await new BrapiQuotes(envWith('your-token')).getQuotes([
      'ITSA4',
      'XYZW9',
      'HGLG11',
    ]);

    expect(quotes.map((quote) => quote.ticker)).toEqual(['ITSA4', 'HGLG11']);
  });

  it('SHOULD rethrow a limit error raised while asking one by one', async () => {
    getSpy.mockRejectedValueOnce(notFound());
    getSpy.mockRejectedValueOnce({ response: { status: 429 } });

    await expect(new BrapiQuotes(envWith('your-token')).getQuotes(['A1', 'B1'])).rejects.toThrow(
      '429',
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

describe('BrapiQuotes.getIncomeEvents (spec 107)', () => {
  it('SHOULD ask for the dividends of one ticker AND map label, dates and rate', async () => {
    getSpy.mockResolvedValue({
      data: {
        results: [
          {
            dividendsData: {
              cashDividends: [
                {
                  label: 'DIVIDENDO',
                  lastDatePrior: '2026-11-21T00:00:00.000Z',
                  paymentDate: '2026-12-19T00:00:00.000Z',
                  rate: 0.47,
                },
                { label: 'JRS CAP PROPRIO', lastDatePrior: '2026-09-10T00:00:00.000Z', rate: 0.28 },
                { label: 'RENDIMENTO', lastDatePrior: '2026-10-29T00:00:00.000Z', rate: 1.1 },
                { label: 'BONIFICACAO', lastDatePrior: '2026-08-01T00:00:00.000Z', rate: 2 },
              ],
            },
          },
        ],
      },
    });

    const events = await new BrapiQuotes(envWith('your-token')).getIncomeEvents('petr4');

    expect(getSpy).toHaveBeenCalledWith('https://brapi.dev/api/quote/PETR4', {
      params: { dividends: 'true', token: 'your-token' },
      timeout: 5000,
    });
    expect(events).toEqual([
      {
        amountPerUnit: '0.47',
        currency: 'BRL',
        exDate: '2026-11-21',
        paymentDate: '2026-12-19',
        ticker: 'PETR4',
        type: 'DIVIDEND',
      },
      {
        amountPerUnit: '0.28',
        currency: 'BRL',
        exDate: '2026-09-10',
        paymentDate: null,
        ticker: 'PETR4',
        type: 'JCP',
      },
      {
        amountPerUnit: '1.1',
        currency: 'BRL',
        exDate: '2026-10-29',
        paymentDate: null,
        ticker: 'PETR4',
        type: 'YIELD',
      },
      {
        amountPerUnit: '2',
        currency: 'BRL',
        exDate: '2026-08-01',
        paymentDate: null,
        ticker: 'PETR4',
        type: 'OTHER',
      },
    ]);
  });

  it('SHOULD skip rows without an ex-date or a positive rate AND return [] without data', async () => {
    getSpy.mockResolvedValue({
      data: {
        results: [
          {
            dividendsData: {
              cashDividends: [{ rate: 1 }, { lastDatePrior: '2026-11-21T00:00:00.000Z', rate: 0 }],
            },
          },
        ],
      },
    });
    const brapi = new BrapiQuotes(envWith('your-token'));

    expect(await brapi.getIncomeEvents('PETR4')).toEqual([]);

    getSpy.mockResolvedValue({ data: { results: [] } });

    expect(await brapi.getIncomeEvents('PETR4')).toEqual([]);
  });

  it('SHOULD throw WHEN the token is missing OR the source answers 429', async () => {
    await expect(new BrapiQuotes(envWith()).getIncomeEvents('PETR4')).rejects.toBeInstanceOf(
      QuoteSourceUnavailableError,
    );

    getSpy.mockRejectedValue({ response: { status: 429 } });

    await expect(
      new BrapiQuotes(envWith('your-token')).getIncomeEvents('PETR4'),
    ).rejects.toBeInstanceOf(QuoteSourceLimitError);
  });
});
