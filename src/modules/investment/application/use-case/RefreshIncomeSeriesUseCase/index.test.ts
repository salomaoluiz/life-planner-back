import { scenario, setup, spies } from './index.mocks';

it('SHOULD materialize every active series under the advisory lock (spec 115 FR 18)', async () => {
  jest.setSystemTime(new Date('2026-12-01T03:10:00Z'));
  spies.incomes.runExclusive.mockImplementation(async (_key: number, fn: () => Promise<void>) => {
    await fn();

    return true;
  });

  expect(await setup.execute()).toEqual({ skipped: false });
  expect(spies.series.findAllActive).toHaveBeenCalledTimes(1);
  expect(spies.series.materialize).toHaveBeenCalledWith(
    expect.objectContaining({ lastGeneratedNumber: 24, seriesId: scenario.series.id }),
  );
});

it('SHOULD skip WHEN another instance holds the lock', async () => {
  spies.incomes.runExclusive.mockResolvedValue(false);

  expect(await setup.execute()).toEqual({ skipped: true });
  expect(spies.series.findAllActive).not.toHaveBeenCalled();
});
