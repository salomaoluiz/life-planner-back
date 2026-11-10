import { HttpException, NotFoundException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

const input = { accessibleOwners: mocks.owners, userId: 'user-1' };

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-04T16:00:00Z'));
  spies.investments.findAssetsByOwners.mockResolvedValue([mocks.brStock, mocks.usStock]);
  spies.quotes.findQuotes.mockResolvedValue([mocks.quote]);
  spies.fetcher.fetchMarket.mockResolvedValue({ failed: [], fetched: 1 });
  spies.fetcher.fetchFx.mockResolvedValue({
    pair: 'USD-BRL',
    quotedAt: new Date('2026-11-04T16:00:00Z'),
    rate: '5.5601',
    source: 'BRAPI',
  });
});

afterEach(() => jest.useRealTimers());

describe('RefreshQuotesNowUseCase', () => {
  it('SHOULD fetch the symbols of the readable assets per market AND the rate for USD assets', async () => {
    const result = await setup.execute(input);

    expect(spies.fetcher.fetchMarket).toHaveBeenCalledTimes(2);
    expect(spies.fetcher.fetchMarket.mock.calls.map(([market]) => market)).toEqual(['B3', 'US']);
    expect(spies.fetcher.fetchFx).toHaveBeenCalled();
    expect(result.fx?.rate).toBe('5.5601');
    expect(result.nextRefreshAt).toEqual(new Date('2026-11-04T16:01:00Z'));
    expect(result.quotes[0]).toMatchObject({ stale: false, ticker: 'ITSA4' });
  });

  it('SHOULD skip the rate WHEN no selected asset is in USD', async () => {
    spies.investments.findAssetsByOwners.mockResolvedValue([mocks.brStock]);

    const result = await setup.execute(input);

    expect(spies.fetcher.fetchFx).not.toHaveBeenCalled();
    expect(result.fx).toBeNull();
  });

  it('SHOULD answer 429 REFRESH_TOO_SOON with the seconds left WHEN called again within 60 s', async () => {
    await setup.execute(input);
    jest.setSystemTime(new Date('2026-11-04T16:00:18Z'));

    const error = await setup.execute(input).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'REFRESH_TOO_SOON',
      retryAfterSeconds: 42,
    });
  });

  it('SHOULD allow another user AND the same user after the cooldown', async () => {
    await setup.execute(input);
    await setup.execute({ ...input, userId: 'user-2' });
    jest.setSystemTime(new Date('2026-11-04T16:01:01Z'));

    await expect(setup.execute(input)).resolves.toBeDefined();
  });

  it('SHOULD limit to the given assetIds AND answer 404 for one the caller cannot read', async () => {
    await setup.execute({ ...input, assetIds: ['asset-br'] });

    expect(spies.fetcher.fetchMarket).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-11-04T16:05:00Z'));
    await expect(
      setup.execute({ ...input, assetIds: ['asset-br', 'nope'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SHOULD return the unchanged quote with stale: true WHEN the source failed (no 5xx)', async () => {
    spies.fetcher.fetchMarket.mockResolvedValue({ failed: ['ITSA4'], fetched: 0 });

    const result = await setup.execute(input);

    expect(result.quotes[0].stale).toBe(true);
  });

  it('SHOULD fall back to the stored rate WHEN the rate fetch fails', async () => {
    spies.fetcher.fetchFx.mockResolvedValue(null);
    spies.quotes.findFx.mockResolvedValue({ pair: 'USD-BRL', rate: '5.5' });

    expect((await setup.execute(input)).fx).toEqual({ pair: 'USD-BRL', rate: '5.5' });
  });
});
