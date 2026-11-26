import { NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { location } from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { mocks, setup } from './index.mocks';

const input = {
  accessibleOwners: mocks.accessibleOwners,
  owner: OwnerType.USER,
  ownerId: 'user-id',
};

beforeEach(() => {
  mocks.catalog.findLocations.mockResolvedValue([
    location('fridge'),
    location('old', { status: StockCatalogStatus.ARCHIVED }),
  ]);
  mocks.catalog.countItemsByLocation.mockResolvedValue(new Map([['fridge', 3]]));
});

it('SHOULD return the active locations with item counts, and the archived ones on request', async () => {
  expect((await setup.execute(input)).map((row) => [row.location.id, row.itemCount])).toEqual([
    ['fridge', 3],
  ]);
  expect(
    (await setup.execute({ ...input, includeArchived: true })).map((row) => row.location.id),
  ).toEqual(['fridge', 'old']);
});

it('SHOULD answer 404 for an owner the caller cannot reach', async () => {
  await expect(setup.execute({ ...input, ownerId: 'other' })).rejects.toThrow(NotFoundException);
});

it('SHOULD count the sub-locations in the parent and read every owner WHEN none is given', async () => {
  mocks.catalog.findLocations.mockResolvedValue([
    location('kitchen'),
    location('fridge', { parentId: 'kitchen' }),
  ]);
  mocks.catalog.countItemsByLocation.mockResolvedValue(
    new Map([
      ['fridge', 2],
      ['kitchen', 1],
    ]),
  );

  const rows = await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(mocks.catalog.findLocations).toHaveBeenCalledTimes(mocks.accessibleOwners.length);
  expect(rows[0]).toMatchObject({ itemCount: 3 });
});
