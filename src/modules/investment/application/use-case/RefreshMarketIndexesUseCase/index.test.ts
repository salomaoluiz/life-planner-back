import { MarketIndexSeries } from '@investment/domain/enum';
import { MarketIndexSourceError } from '@shared/infra/market-index/types';

import { mocks, setup, spies } from './index.mocks';

const TODAY = '2026-11-16';

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(`${TODAY}T22:00:00Z`));
  spies.quotes.runExclusive.mockImplementation(async (_key: number, fn: () => Promise<void>) => {
    await fn();

    return true;
  });
  spies.indexes.findLatestDates.mockResolvedValue(new Map());
  spies.indexes.recalculateIndexedTitles.mockResolvedValue(0);
  spies.bcb.getSeries.mockResolvedValue([]);
  spies.bcb.getIpcaExpectation.mockResolvedValue([]);
});
afterEach(() => {
  jest.useRealTimers();
});

describe('RefreshMarketIndexesUseCase', () => {
  it('SHOULD backfill every series from 2000-01-01 WHEN none is stored', async () => {
    spies.bcb.getSeries.mockResolvedValue([mocks.point('2026-11-11', '0.050788')]);
    spies.bcb.getIpcaExpectation.mockResolvedValue([mocks.point('2026-11-13', '5.1484')]);

    await (await setup()).execute();

    expect(spies.bcb.getSeries.mock.calls.map((call) => call.slice(0, 3))).toEqual([
      [12, '2000-01-01', TODAY],
      [4389, '2000-01-01', TODAY],
      [11, '2000-01-01', TODAY],
      [432, '2000-01-01', TODAY],
      [433, '2000-01-01', TODAY],
      [13522, '2000-01-01', TODAY],
    ]);
    expect(spies.bcb.getIpcaExpectation).toHaveBeenCalledWith('2000-01-01');
    expect(spies.indexes.upsertValues).toHaveBeenCalledTimes(7);
    expect(spies.indexes.upsertValues).toHaveBeenCalledWith(
      MarketIndexSeries.CDI_DAILY,
      [{ date: '2026-11-11', source: 'BCB_SGS', value: '0.050788' }],
      expect.any(Date),
    );
    expect(spies.indexes.upsertValues).toHaveBeenCalledWith(
      MarketIndexSeries.IPCA_EXPECTED_12M,
      [{ date: '2026-11-13', source: 'BCB_FOCUS', value: '5.1484' }],
      expect.any(Date),
    );
    expect(spies.indexes.recordFetch).toHaveBeenCalledWith(MarketIndexSeries.CDI_DAILY, {
      at: expect.any(Date),
      error: null,
    });
    expect(spies.indexes.recalculateIndexedTitles).toHaveBeenCalledTimes(1);
  });

  it('SHOULD fetch from the latest stored date minus 10 days WHEN the series exists', async () => {
    spies.indexes.findLatestDates.mockResolvedValue(
      new Map([[MarketIndexSeries.CDI_DAILY, '2026-11-11']]),
    );

    await (await setup()).execute();

    expect(spies.bcb.getSeries.mock.calls[0].slice(0, 3)).toEqual([12, '2026-11-01', TODAY]);
    expect(spies.bcb.getSeries.mock.calls[1].slice(0, 3)).toEqual([4389, '2000-01-01', TODAY]);
  });

  it('SHOULD keep the other series AND record HTTP_503 WHEN one source fails', async () => {
    spies.bcb.getSeries.mockImplementation(async (code: number) => {
      if (code === 12) {
        throw new MarketIndexSourceError('HTTP_503');
      }

      return [mocks.point('2026-11-11', '13.65')];
    });

    await (await setup()).execute();

    expect(spies.indexes.recordFetch).toHaveBeenCalledWith(MarketIndexSeries.CDI_DAILY, {
      at: expect.any(Date),
      error: 'HTTP_503',
    });
    expect(spies.indexes.recordFetch).toHaveBeenCalledWith(MarketIndexSeries.CDI_ANNUAL, {
      at: expect.any(Date),
      error: null,
    });
    expect(spies.indexes.upsertValues).not.toHaveBeenCalledWith(
      MarketIndexSeries.CDI_DAILY,
      expect.anything(),
      expect.anything(),
    );
    expect(spies.indexes.upsertValues).toHaveBeenCalledWith(
      MarketIndexSeries.CDI_ANNUAL,
      expect.anything(),
      expect.anything(),
    );
  });

  it('SHOULD record ERROR for an unexpected failure AND not store out of range values', async () => {
    spies.bcb.getSeries.mockImplementation(async (code: number) => {
      if (code === 11) {
        throw new Error('boom');
      }

      return [mocks.point('2026-11-10', '0.9'), mocks.point('2026-11-11', '0.05')];
    });

    await (await setup()).execute();

    expect(spies.indexes.recordFetch).toHaveBeenCalledWith(MarketIndexSeries.SELIC_DAILY, {
      at: expect.any(Date),
      error: 'ERROR',
    });
    expect(spies.indexes.upsertValues).toHaveBeenCalledWith(
      MarketIndexSeries.CDI_DAILY,
      [{ date: '2026-11-11', source: 'BCB_SGS', value: '0.05' }],
      expect.any(Date),
    );
    expect(spies.indexes.recordFetch).toHaveBeenCalledWith(MarketIndexSeries.CDI_DAILY, {
      at: expect.any(Date),
      error: 'OUT_OF_RANGE',
    });
  });

  it('SHOULD not store rows dated after today (SGS 432 carries the next Copom days)', async () => {
    spies.bcb.getSeries.mockResolvedValue([
      mocks.point('2026-11-13', '13.75'),
      mocks.point('2026-12-09', '13.75'),
    ]);

    await (await setup()).execute();

    expect(spies.indexes.upsertValues).toHaveBeenCalledWith(
      MarketIndexSeries.SELIC_TARGET,
      [{ date: '2026-11-13', source: 'BCB_SGS', value: '13.75' }],
      expect.any(Date),
    );
  });

  it('SHOULD only fetch the stale or missing series WHEN onlyStale is set', async () => {
    spies.indexes.findLatestDates.mockResolvedValue(
      new Map([
        [MarketIndexSeries.CDI_ANNUAL, '2026-11-13'],
        [MarketIndexSeries.CDI_DAILY, '2026-11-13'],
        [MarketIndexSeries.IPCA_12M, '2026-07-01'],
        [MarketIndexSeries.IPCA_EXPECTED_12M, '2026-11-13'],
        [MarketIndexSeries.IPCA_MONTHLY, '2026-10-01'],
        [MarketIndexSeries.SELIC_DAILY, '2026-11-13'],
        [MarketIndexSeries.SELIC_TARGET, '2026-11-13'],
      ]),
    );

    await (await setup()).execute({ onlyStale: true });

    expect(spies.bcb.getSeries.mock.calls.map((call) => call[0])).toEqual([13522]);
    expect(spies.bcb.getIpcaExpectation).not.toHaveBeenCalled();
  });

  it('SHOULD not recalculate the titles WHEN nothing new arrived', async () => {
    spies.indexes.findLatestDates.mockResolvedValue(
      new Map([
        [MarketIndexSeries.CDI_DAILY, '2026-11-11'],
        [MarketIndexSeries.IPCA_EXPECTED_12M, '2026-11-13'],
        [MarketIndexSeries.IPCA_MONTHLY, '2026-10-01'],
      ]),
    );
    spies.bcb.getSeries.mockImplementation(async (code: number) => {
      if (code === 12) {
        return [mocks.point('2026-11-11', '0.05')];
      }

      return code === 433 ? [mocks.point('2026-10-01', '0.14')] : [];
    });
    spies.bcb.getIpcaExpectation.mockResolvedValue([mocks.point('2026-11-13', '5')]);

    await (await setup()).execute();

    expect(spies.indexes.recalculateIndexedTitles).not.toHaveBeenCalled();
  });

  it('SHOULD log a failed recalculation without stopping AND skip WHEN another instance holds the lock', async () => {
    spies.bcb.getSeries.mockResolvedValue([mocks.point('2026-11-11', '0.05')]);
    spies.indexes.recalculateIndexedTitles.mockRejectedValue(new Error('db'));

    await expect((await setup()).execute()).resolves.toMatchObject({ skipped: false });
    expect(spies.logger.log).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('recalculate'),
      expect.objectContaining({ module: 'RefreshMarketIndexesUseCase' }),
    );

    spies.quotes.runExclusive.mockResolvedValue(false);
    spies.bcb.getSeries.mockClear();

    await expect((await setup()).execute()).resolves.toMatchObject({ skipped: true });
    expect(spies.bcb.getSeries).not.toHaveBeenCalled();
  });
});
