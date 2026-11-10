import { ServiceUnavailableException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup, spies } from './index.mocks';

describe('SearchTickersUseCase', () => {
  it('SHOULD search brapi for B3 AND map the item with currency and exchange', async () => {
    spies.brapi.search.mockResolvedValue([mocks.result]);

    const items = await setup.execute({ market: 'B3' as never, q: ' itsa ' });

    expect(spies.brapi.search).toHaveBeenCalledWith('itsa');
    expect(items).toEqual([
      {
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

  it('SHOULD search Finnhub for US in USD', async () => {
    spies.finnhub.search.mockResolvedValue([{ ...mocks.result, ticker: 'AAPL' }]);

    const items = await setup.execute({ market: 'US' as never, q: 'appl' });

    expect(items[0]).toMatchObject({ currency: 'USD', market: 'US', ticker: 'AAPL' });
  });

  it('SHOULD answer from the cache for 10 minutes per (market, normalized query)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-04T16:00:00Z'));
    spies.brapi.search.mockResolvedValue([mocks.result]);

    await setup.execute({ market: 'B3' as never, q: 'ITSA' });
    await setup.execute({ market: 'B3' as never, q: 'itsa' });

    expect(spies.brapi.search).toHaveBeenCalledTimes(1);

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
