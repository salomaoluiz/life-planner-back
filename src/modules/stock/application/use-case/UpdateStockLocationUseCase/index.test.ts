import { ConflictException, NotFoundException } from '@nestjs/common';

import { location } from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { mocks, setup } from './index.mocks';

const input = { accessibleOwners: mocks.accessibleOwners, id: 'a' };

beforeEach(() => {
  mocks.catalog.findLocationById.mockResolvedValue(location('a', { name: 'Pantry' }));
  mocks.catalog.findLocations.mockResolvedValue([
    location('a', { name: 'Pantry' }),
    location('b', { name: 'Fridge' }),
  ]);
  mocks.catalog.updateLocation.mockResolvedValue(location('a'));
});

it('SHOULD rename and archive/reactivate', async () => {
  await setup.execute({ ...input, name: 'Garage', status: StockCatalogStatus.ARCHIVED });

  expect(mocks.catalog.updateLocation).toHaveBeenCalledWith({
    id: 'a',
    name: 'Garage',
    status: 'ARCHIVED',
  });
});

it('SHOULD not check names WHEN only the status changes, and allow keeping its own name', async () => {
  await setup.execute({ ...input, status: StockCatalogStatus.ACTIVE });
  expect(mocks.catalog.findLocations).not.toHaveBeenCalled();

  await expect(setup.execute({ ...input, name: 'pantry' })).resolves.toBeDefined();
});

it('SHOULD refuse a name taken by another location with 409', async () => {
  await expect(setup.execute({ ...input, name: 'FRIDGE' })).rejects.toThrow(ConflictException);
});

it('SHOULD answer 404 WHEN the location is missing or of another owner', async () => {
  mocks.catalog.findLocationById.mockResolvedValue(undefined);
  await expect(setup.execute({ ...input, name: 'x' })).rejects.toThrow(NotFoundException);

  mocks.catalog.findLocationById.mockResolvedValue(location('a', { ownerId: 'other' }));
  await expect(setup.execute({ ...input, name: 'x' })).rejects.toThrow(NotFoundException);
});
