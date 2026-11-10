import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

import { setup, spies } from './index.mocks';

describe('HistoryBackfill.run', () => {
  it('SHOULD insert the free-tier range of closes WHEN the ticker has no history', async () => {
    spies.repository.hasHistory.mockResolvedValue(false);
    spies.brapi.getDailyHistory.mockResolvedValue([
      { close: '10.5', date: '2026-11-03' },
      { close: '10.53', date: '2026-11-04' },
    ]);

    expect(await setup.run('ITSA4')).toBe(2);
    expect(spies.brapi.getDailyHistory).toHaveBeenCalledWith('ITSA4', '3mo');
    expect(spies.repository.saveHistory.mock.calls[0][0][0]).toMatchObject({
      date: '2026-11-03',
      market: 'B3',
      source: 'BRAPI',
    });
  });

  it('SHOULD do nothing WHEN the ticker already has history', async () => {
    spies.repository.hasHistory.mockResolvedValue(true);

    expect(await setup.run('ITSA4')).toBe(0);
    expect(spies.brapi.getDailyHistory).not.toHaveBeenCalled();
  });
});

describe('HistoryBackfill.queue', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick'] }));
  afterEach(() => jest.useRealTimers());

  it('SHOULD ignore US symbols (Finnhub has no daily history)', async () => {
    setup.queue(QuoteMarket.US, 'AAPL');
    await jest.runAllTimersAsync();

    expect(spies.repository.hasHistory).not.toHaveBeenCalled();
  });

  it('SHOULD run after the response AND log (not throw) WHEN the backfill fails', async () => {
    spies.repository.hasHistory.mockRejectedValue(new Error('db'));

    setup.queue(QuoteMarket.B3, 'ITSA4');
    await jest.runAllTimersAsync();

    expect(spies.logger.log).toHaveBeenCalledWith(
      'warn',
      'History backfill failed',
      expect.objectContaining({ error: 'db' }),
    );
  });
});
