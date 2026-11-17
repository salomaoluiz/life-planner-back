import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, from: '2026-12-01', to: '2027-02-28' };

it('SHOULD project the occurrences after the current month with the current position (spec 115 FR 21)', async () => {
  const items = await setup.execute(base);

  expect(
    items.map((item) => [item.paymentDate, item.number, item.quantity, item.netAmount]),
  ).toEqual([
    ['2026-12-15', 24, '100', 11000],
    ['2027-01-15', 25, '100', 11000],
    ['2027-02-15', 26, '100', 11000],
  ]);
  expect(items[0]).toMatchObject({
    accountId: 'acc-1',
    assetLabel: 'HGLG11',
    exDate: '2026-12-07',
    seriesId: scenario.series.id,
    withFinance: true,
  });
});

it('SHOULD never reach beyond 24 months AND never project the current month', async () => {
  const items = await setup.execute({ ...base, from: '2026-01-01', to: '2040-01-01' });

  expect(items[0].paymentDate).toBe('2026-12-15');
  expect(items[items.length - 1].paymentDate <= '2028-12-31').toBe(true);
});

it('SHOULD give nothing WHEN the position is zero, the owner is archived or the range is empty', async () => {
  spies.investment.findAssetById.mockResolvedValueOnce({ ...scenario.detail, operations: [] });
  expect(await setup.execute(base)).toEqual([]);

  expect(
    await setup.execute({
      ...base,
      accessibleOwners: scenario.owners.map((owner) => ({ ...owner, archived: true })),
    }),
  ).toEqual([]);
  expect(await setup.execute({ ...base, from: '2027-03-01', to: '2027-02-01' })).toEqual([]);
});

it('SHOULD skip an unknown asset AND skip numbers that are already real', async () => {
  spies.investment.findAssetById.mockResolvedValueOnce(undefined);
  expect(await setup.execute(base)).toEqual([]);

  spies.series.findActiveByOwners.mockResolvedValue([
    { ...scenario.series, lastGeneratedNumber: 24 },
  ]);

  expect((await setup.execute(base)).map((item) => item.number)).toEqual([25, 26]);
});

it('SHOULD narrow to the requested owner', async () => {
  expect(await setup.execute({ ...base, ownerIds: ['other'] })).toEqual([]);
});
