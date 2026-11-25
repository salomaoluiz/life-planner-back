import { BadRequestException } from '@nestjs/common';

import { item, lot } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

it('SHOULD search the normalized code in every accessible owner in one call', async () => {
  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    code: '036000291452',
  });

  expect(mocks.stock.findByOwners).toHaveBeenCalledTimes(1);
  expect(mocks.stock.findByOwners).toHaveBeenCalledWith(
    mocks.accessibleOwners.map(({ owner, ownerId }) => ({ owner, ownerId })),
    { barcode: '0036000291452' },
  );
  expect(result).toEqual({ code: '0036000291452', views: [] });
  expect(mocks.catalog.findCatalogByOwners).not.toHaveBeenCalled();
});

it('SHOULD return a view per match', async () => {
  mocks.stock.findByOwners.mockResolvedValue([item([lot('l1', 3)])]);

  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    code: '7891000100103',
  });

  expect(result.views).toHaveLength(1);
  expect(result.views[0].quantity).toBe(3);
});

it('SHOULD answer 400 for a wrong check digit WITHOUT querying', async () => {
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, code: '7891000100104' }),
  ).rejects.toThrow(BadRequestException);
  expect(mocks.stock.findByOwners).not.toHaveBeenCalled();
});
