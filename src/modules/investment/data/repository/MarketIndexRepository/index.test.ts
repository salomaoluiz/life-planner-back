import { InvestmentFixedIncomeRateMode, MarketIndexSeries } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('MarketIndexRepository', () => {
  it('SHOULD read the series from before `from` in ONE query WHEN an expectation exists', async () => {
    spies.findValues.mockResolvedValue([
      { date: day('2026-03-02'), series: 'CDI_DAILY', value: mocks.decimal('0.050788') },
      { date: day('2026-03-01'), series: 'IPCA_MONTHLY', value: mocks.decimal('0.5') },
      { date: day('2026-03-10'), series: 'IPCA_EXPECTED_12M', value: mocks.decimal('4.2') },
    ]);

    const data = await (await setup()).findSeriesData('2026-03-20');

    expect(data).toEqual({
      cdiDaily: [{ date: '2026-03-02', value: 0.050788 }],
      ipcaExpected: [{ date: '2026-03-10', value: 4.2 }],
      ipcaMonthly: [{ date: '2026-03-01', value: 0.5 }],
    });
    expect(spies.findValues).toHaveBeenCalledTimes(1);
    expect(spies.findLatestBefore).not.toHaveBeenCalled();
    // Window starts at the first of the month (before from - 10 days = 03-10).
    expect(spies.findValues.mock.calls[0][1]).toEqual(day('2026-03-01'));
  });

  it('SHOULD ask for the latest expectation WHEN none fell inside the window', async () => {
    spies.findValues.mockResolvedValue([]);
    spies.findLatestBefore.mockResolvedValue({
      date: day('2026-01-05'),
      value: mocks.decimal('3.9'),
    });

    const data = await (await setup()).findSeriesData('2026-03-20');

    expect(data.ipcaExpected).toEqual([{ date: '2026-01-05', value: 3.9 }]);
  });

  it('SHOULD return empty series WHEN nothing is stored', async () => {
    spies.findValues.mockResolvedValue([]);
    spies.findLatestBefore.mockResolvedValue(null);

    expect(await (await setup()).findSeriesData('2026-03-20')).toEqual({
      cdiDaily: [],
      ipcaExpected: [],
      ipcaMonthly: [],
    });
  });

  it('SHOULD map latest rows, latest dates, history and fetches', async () => {
    spies.findLatest.mockResolvedValue([
      { date: day('2026-11-11'), series: 'CDI_ANNUAL', value: mocks.decimal('14.9') },
    ]);
    spies.findLatestDates.mockResolvedValue([{ date: day('2026-11-11'), series: 'CDI_ANNUAL' }]);
    spies.findValues.mockResolvedValue([
      { date: day('2026-06-18'), series: 'CDI_ANNUAL', value: mocks.decimal('14.9') },
    ]);
    spies.findFetches.mockResolvedValue([
      { last_attempt_at: null, last_error: 'HTTP_503', last_success_at: null, series: 'CDI_DAILY' },
    ]);
    const repository = await setup();

    expect((await repository.findLatest()).get(MarketIndexSeries.CDI_ANNUAL)).toEqual({
      date: '2026-11-11',
      value: '14.9',
    });
    expect((await repository.findLatestDates()).get(MarketIndexSeries.CDI_ANNUAL)).toBe(
      '2026-11-11',
    );
    expect(
      await repository.findHistory(MarketIndexSeries.CDI_ANNUAL, '2026-01-01', '2026-11-12'),
    ).toEqual([{ date: '2026-06-18', value: '14.9' }]);
    expect(await repository.findFetches()).toEqual([
      { lastAttemptAt: null, lastError: 'HTTP_503', lastSuccessAt: null, series: 'CDI_DAILY' },
    ]);
  });

  it('SHOULD list the followers by their latest started rate AND skip the query without owners', async () => {
    spies.findFollowers.mockResolvedValue([
      {
        fixed_income_rates: [
          {
            cdi_percent: mocks.decimal('100'),
            mode: 'CDI_PERCENT',
            spread: null,
            start_date: day('2026-01-01'),
          },
          {
            cdi_percent: null,
            mode: 'IPCA_PLUS',
            spread: mocks.decimal('6'),
            start_date: day('2026-06-01'),
          },
          {
            cdi_percent: mocks.decimal('120'),
            mode: 'CDI_PERCENT',
            spread: null,
            start_date: day('2027-01-01'),
          },
        ],
        id: 'asset-1',
        name: 'CDB Example',
      },
      { fixed_income_rates: [], id: 'asset-2', name: 'No rate' },
    ]);
    const repository = await setup();

    expect(await repository.findFollowers([], '2026-11-12')).toEqual([]);
    expect(spies.findFollowers).not.toHaveBeenCalled();

    expect(
      await repository.findFollowers(
        [{ archived: false, owner: OwnerType.USER, ownerId: 'user-id' }],
        '2026-11-12',
      ),
    ).toEqual([
      {
        assetId: 'asset-1',
        cdiPercent: null,
        mode: InvestmentFixedIncomeRateMode.IPCA_PLUS,
        name: 'CDB Example',
        spread: '6',
      },
    ]);
    expect(spies.findFollowers).toHaveBeenCalledWith([{ owner: 'USER', owner_id: 'user-id' }]);
  });

  it('SHOULD recalculate every indexed title AND count the ones that fit', async () => {
    spies.findIndexedAssetIds.mockResolvedValue(['a', 'b', 'c']);
    spies.recalculateAsset
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    expect(await (await setup()).recalculateIndexedTitles()).toBe(2);
    expect(spies.recalculateAsset).toHaveBeenCalledTimes(3);
  });

  it('SHOULD map fx pairs, upsert only non empty rows, record fetches and stamp the version', async () => {
    spies.findFxPairs.mockResolvedValue([
      { pair: 'USD-BRL', quoted_at: new Date('2026-11-12T11:05:00Z'), rate: mocks.decimal('5.35') },
    ]);
    spies.versionStamp
      .mockResolvedValueOnce(new Date('2026-11-12T13:10:00Z'))
      .mockResolvedValueOnce(null);
    const repository = await setup();
    const at = new Date('2026-11-12T13:10:00Z');

    expect(await repository.findFxPairs()).toEqual([
      { pair: 'USD-BRL', quotedAt: new Date('2026-11-12T11:05:00Z'), rate: '5.350000' },
    ]);

    await repository.upsertValues(MarketIndexSeries.CDI_DAILY, [], at);
    await repository.upsertValues(
      MarketIndexSeries.CDI_DAILY,
      [{ date: '2026-11-11', source: 'BCB_SGS', value: '0.05' }],
      at,
    );
    await repository.recordFetch(MarketIndexSeries.CDI_DAILY, { at, error: null });

    expect(spies.upsertValues).toHaveBeenCalledTimes(1);
    expect(spies.upsertValues.mock.calls[0][1][0].date).toEqual(day('2026-11-11'));
    expect(spies.recordFetch).toHaveBeenCalledWith('CDI_DAILY', { at, error: null });
    expect(await repository.versionStamp()).toBe('2026-11-12T13:10:00.000Z');
    expect(await repository.versionStamp()).toBe('none');
  });
});
