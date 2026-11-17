import { setup, spies } from './index.mocks';

beforeEach(() => {
  jest.resetAllMocks();
});

describe('MarketIndexDatasource', () => {
  it('SHOULD read values of the series from a date, optionally up to another', async () => {
    spies.valueFindMany.mockResolvedValue([]);
    const datasource = await setup();
    const from = new Date('2026-01-01');
    const to = new Date('2026-11-01');

    await datasource.findValues(['CDI_DAILY'], from);
    await datasource.findValues(['CDI_ANNUAL'], from, to);

    expect(spies.valueFindMany.mock.calls[0][0].where).toEqual({
      date: { gte: from },
      series: { in: ['CDI_DAILY'] },
    });
    expect(spies.valueFindMany.mock.calls[1][0].where.date).toEqual({ gte: from, lte: to });
  });

  it('SHOULD read the latest row per series AND the latest dates, skipping empty groups', async () => {
    spies.valueFindMany.mockResolvedValue([{ series: 'CDI_ANNUAL' }]);
    spies.valueGroupBy.mockResolvedValue([
      { _max: { date: new Date('2026-11-11') }, series: 'CDI_ANNUAL' },
      { _max: { date: null }, series: 'SELIC_TARGET' },
    ]);
    const datasource = await setup();

    expect(await datasource.findLatest()).toEqual([{ series: 'CDI_ANNUAL' }]);
    expect(spies.valueFindMany.mock.calls[0][0].distinct).toEqual(['series']);
    expect(await datasource.findLatestDates()).toEqual([
      { date: new Date('2026-11-11'), series: 'CDI_ANNUAL' },
    ]);
  });

  it('SHOULD find the latest row before a date AND the latest fetch stamp', async () => {
    spies.valueFindFirst.mockResolvedValue({ series: 'IPCA_EXPECTED_12M' });
    spies.valueAggregate.mockResolvedValue({ _max: { fetched_at: new Date('2026-11-12') } });
    const datasource = await setup();

    expect(await datasource.findLatestBefore('IPCA_EXPECTED_12M', new Date('2026-11-13'))).toEqual({
      series: 'IPCA_EXPECTED_12M',
    });
    expect(await datasource.versionStamp()).toEqual(new Date('2026-11-12'));
  });

  it('SHOULD list active calculated titles of the owners with their rates AND the fx pairs AND the fetches', async () => {
    spies.assetFindMany.mockResolvedValue([]);
    spies.fxFindMany.mockResolvedValue([{ pair: 'USD-BRL' }]);
    spies.fetchFindMany.mockResolvedValue([{ series: 'CDI_DAILY' }]);
    const datasource = await setup();

    await datasource.findFollowers([{ owner: 'USER', owner_id: 'user-id' }]);

    expect(spies.assetFindMany.mock.calls[0][0].where).toEqual({
      fixed_income_terms: { isNot: null },
      OR: [{ owner: 'USER', owner_id: 'user-id' }],
      status: 'ACTIVE',
    });
    expect(await datasource.findFxPairs()).toEqual([{ pair: 'USD-BRL' }]);
    expect(await datasource.findFetches()).toEqual([{ series: 'CDI_DAILY' }]);
  });

  it('SHOULD set last_success_at only WHEN the fetch succeeded', async () => {
    const datasource = await setup();
    const at = new Date('2026-11-12T13:10:00Z');

    await datasource.recordFetch('CDI_DAILY', { at, error: null });
    await datasource.recordFetch('CDI_DAILY', { at, error: 'HTTP_503' });

    expect(spies.fetchUpsert.mock.calls[0][0].update).toEqual({
      last_attempt_at: at,
      last_error: null,
      last_success_at: at,
    });
    expect(spies.fetchUpsert.mock.calls[1][0].update).toEqual({
      last_attempt_at: at,
      last_error: 'HTTP_503',
    });
    expect(spies.fetchUpsert.mock.calls[1][0].create.last_success_at).toBeNull();
  });

  it('SHOULD upsert in chunks of 1000 rows with ON CONFLICT', async () => {
    const datasource = await setup();
    const rows = Array.from({ length: 2001 }, (_, index) => ({
      date: new Date(Date.UTC(2000, 0, 1 + index)),
      source: 'BCB_SGS',
      value: '0.05',
    }));

    await datasource.upsertValues('CDI_DAILY', rows, new Date());

    expect(spies.executeRaw).toHaveBeenCalledTimes(3);
    expect(spies.executeRaw.mock.calls[0][0].sql).toContain('ON CONFLICT (series, date)');
  });

  it('SHOULD return null WHEN nothing was ever fetched', async () => {
    spies.valueAggregate.mockResolvedValue({ _max: { fetched_at: null } });

    expect(await (await setup()).versionStamp()).toBeNull();
  });
});
