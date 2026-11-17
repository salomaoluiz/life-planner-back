import { NotFoundException } from '@nestjs/common';

import { scenario, setup, spies } from './index.mocks';

it('SHOULD answer the series with its next payment date, null once it ended', async () => {
  expect(
    await setup.execute({ accessibleOwners: scenario.owners, id: scenario.series.id }),
  ).toEqual({
    nextPaymentDate: '2026-12-15',
    series: scenario.series,
  });

  spies.series.findById.mockResolvedValue({ ...scenario.series, endedAt: '2026-11-15' });

  expect(
    (await setup.execute({ accessibleOwners: scenario.owners, id: scenario.series.id }))
      .nextPaymentDate,
  ).toBeNull();
});

it('SHOULD answer null WHEN the end date is before the next occurrence', async () => {
  spies.series.findById.mockResolvedValue({ ...scenario.series, endDate: '2026-12-01' });

  expect(
    (await setup.execute({ accessibleOwners: scenario.owners, id: scenario.series.id }))
      .nextPaymentDate,
  ).toBeNull();
});

it('SHOULD answer 404 for an unknown series OR an asset out of reach', async () => {
  spies.series.findById.mockResolvedValueOnce(undefined);
  await expect(
    setup.execute({ accessibleOwners: scenario.owners, id: 'x' }),
  ).rejects.toBeInstanceOf(NotFoundException);
  await expect(
    setup.execute({ accessibleOwners: [], id: scenario.series.id }),
  ).rejects.toBeInstanceOf(NotFoundException);
});
