import { ServiceUnavailableException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup, spies } from './index.mocks';

describe('SearchTickersUseCase', () => {
  it('SHOULD search brapi for B3 AND map the item with currency and exchange', async () => {
    spies.brapi.search.mockResolvedValue([mocks.result]);
    spies.brapi.getTickerKinds.mockResolvedValue({ ITSA4: 'STOCK' });

    const items = await setup.execute({ market: 'B3' as never, q: ' itsa ' });

    expect(spies.brapi.search).toHaveBeenCalledWith('itsa');
    expect(items).toEqual([
      {
        assetClass: 'BR_STOCK',
        changePercent: '0.48',
        currency: 'BRL',
        exchange: 'B3',
        logoUrl: 'https://example.com/logo.svg',
        market: 'B3',
        name: 'Itausa PN',
        price: '10.53',
        ticker: 'ITSA4',
      },
    ]);
  });

  it('SHOULD search Finnhub for US in USD AND give every item the foreign class', async () => {
    spies.finnhub.search.mockResolvedValue([{ ...mocks.result, ticker: 'AAPL' }]);

    const items = await setup.execute({ market: 'US' as never, q: 'appl' });

    expect(items[0]).toMatchObject({
      assetClass: 'FOREIGN_STOCK',
      currency: 'USD',
      market: 'US',
      ticker: 'AAPL',
    });
    expect(spies.brapi.getTickerKinds).not.toHaveBeenCalled();
  });

  it('SHOULD carry the class of each B3 kind AND null for a ticker without one', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-04T16:00:00Z'));
    spies.brapi.search.mockResolvedValue([
      { ...mocks.result, ticker: 'KNRI11' },
      { ...mocks.result, ticker: 'BOVA11' },
      { ...mocks.result, ticker: 'RZAG11' },
      { ...mocks.result, ticker: 'XPTO3' },
    ]);
    spies.brapi.getTickerKinds.mockResolvedValue({
      BOVA11: 'ETF',
      KNRI11: 'REIT',
      RZAG11: 'FIAGRO',
    });

    const items = await setup.execute({ market: 'B3' as never, q: 'kn' });

    expect(spies.brapi.getTickerKinds).toHaveBeenCalledTimes(1);
    expect(spies.brapi.getTickerKinds).toHaveBeenCalledWith('kn');
    expect(items.map((item) => [item.ticker, item.assetClass])).toEqual([
      ['KNRI11', 'BR_REIT'],
      ['BOVA11', 'BR_STOCK'],
      ['RZAG11', null],
      ['XPTO3', null],
    ]);
    jest.useRealTimers();
  });

  it('SHOULD answer the items without a class WHEN the kind list fails AND not cache that answer', async () => {
    spies.brapi.search.mockResolvedValue([mocks.result]);
    spies.brapi.getTickerKinds.mockRejectedValue(new Error('down'));

    const items = await setup.execute({ market: 'B3' as never, q: 'itsa' });

    expect(items).toHaveLength(1);
    expect(items[0].assetClass).toBeNull();

    // The failure is not cached: the next search retries the kind list instead of pinning a null class.
    spies.brapi.getTickerKinds.mockResolvedValue({ ITSA4: 'STOCK' });
    const again = await setup.execute({ market: 'B3' as never, q: 'itsa' });

    expect(again[0].assetClass).toBe('BR_STOCK');
  });

  it('SHOULD answer from the cache for 10 minutes per (market, normalized query)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-04T16:00:00Z'));
    spies.brapi.search.mockResolvedValue([mocks.result]);

    spies.brapi.getTickerKinds.mockResolvedValue({ ITSA4: 'STOCK' });
    await setup.execute({ market: 'B3' as never, q: 'ITSA' });
    await setup.execute({ market: 'B3' as never, q: 'itsa' });

    expect(spies.brapi.search).toHaveBeenCalledTimes(1);
    expect(spies.brapi.getTickerKinds).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-11-04T16:11:00Z'));
    await setup.execute({ market: 'B3' as never, q: 'itsa' });

    expect(spies.brapi.search).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('SHOULD answer 503 QUOTE_SOURCE_UNAVAILABLE WHEN the source fails AND not cache the failure', async () => {
    spies.brapi.search.mockRejectedValue(new Error('no token'));

    await expect(setup.execute({ market: 'B3' as never, q: 'itsa' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    spies.brapi.search.mockResolvedValue([]);
    expect(await setup.execute({ market: 'B3' as never, q: 'itsa' })).toEqual([]);
  });

  it('SHOULD refuse a query shorter than 2 or longer than 20 characters', async () => {
    await expect(setup.execute({ market: 'B3' as never, q: 'i' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      setup.execute({ market: 'B3' as never, q: 'x'.repeat(21) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
