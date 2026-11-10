import { ValidationError } from '@shared/domain/error/ValidationError';

import { setup, spies } from './index.mocks';

const b3 = { fetchedAt: null, market: 'B3', ticker: 'ITSA4' };
const us = { fetchedAt: null, market: 'US', ticker: 'AAPL' };

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-04T16:00:00Z'));
  spies.repository.findTrackedSymbols.mockResolvedValue([b3, us]);
  spies.fetcher.fetchMarket.mockResolvedValue({ failed: ['X'], fetched: 3 });
});

afterEach(() => jest.useRealTimers());

describe('RefreshTrackedQuotesUseCase', () => {
  it('SHOULD fetch only the symbols of the target market, tracked in the last 30 days', async () => {
    const result = await setup.execute({ closeRun: true, target: 'B3' });

    expect(spies.repository.findTrackedSymbols).toHaveBeenCalledWith('2026-10-05');
    expect(spies.fetcher.fetchMarket).toHaveBeenCalledWith('B3', [b3], {
      closeRun: true,
      now: new Date('2026-11-04T16:00:00Z'),
    });
    expect(result).toEqual({ failed: 1, fetched: 3, skipped: false });
  });

  it('SHOULD take a different advisory lock per target', async () => {
    await setup.execute({ target: 'B3' });
    await setup.execute({ target: 'US' });
    await setup.execute({ target: 'FX' });

    expect(spies.repository.runExclusive.mock.calls.map(([key]) => key)).toEqual([
      104001, 104002, 104003,
    ]);
  });

  it('SHOULD refresh the USD-BRL rate for the FX target', async () => {
    spies.fetcher.fetchFx.mockResolvedValue({ pair: 'USD-BRL' });

    expect(await setup.execute({ target: 'FX' })).toEqual({
      failed: 0,
      fetched: 1,
      skipped: false,
    });
    expect(spies.fetcher.fetchMarket).not.toHaveBeenCalled();

    spies.fetcher.fetchFx.mockResolvedValue(null);
    expect((await setup.execute({ target: 'FX' })).fetched).toBe(0);
  });

  it('SHOULD skip the run WHEN another instance holds the lock', async () => {
    spies.repository.runExclusive.mockResolvedValue(false);

    const result = await setup.execute({ target: 'B3' });

    expect(result.skipped).toBe(true);
    expect(spies.fetcher.fetchMarket).not.toHaveBeenCalled();
  });

  it('SHOULD refuse an unknown target', async () => {
    await expect(setup.execute({ target: 'XX' as never })).rejects.toBeInstanceOf(ValidationError);
  });
});
