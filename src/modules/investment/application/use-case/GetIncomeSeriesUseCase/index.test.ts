import { NotFoundException } from '@nestjs/common';

import { scenario, setup, spies } from './index.mocks';

it('SHOULD list the series of an asset with their next payment date', async () => {
  const views = await setup.execute({
    accessibleOwners: scenario.owners,
    assetId: scenario.asset.id,
  });

  expect(views).toEqual([{ nextPaymentDate: '2026-12-15', series: scenario.series }]);
  expect(spies.series.findByAsset).toHaveBeenCalledWith(scenario.asset.id);
});

it('SHOULD answer 404 for an asset out of reach', async () => {
  await expect(
    setup.execute({ accessibleOwners: [], assetId: scenario.asset.id }),
  ).rejects.toBeInstanceOf(NotFoundException);
});
