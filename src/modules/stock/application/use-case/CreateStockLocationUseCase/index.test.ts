import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { location } from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { mocks, setup } from './index.mocks';

const input = {
  accessibleOwners: mocks.accessibleOwners,
  color: '#F59E0B',
  icon: 'archive',
  name: 'Pantry',
  owner: OwnerType.USER,
  ownerId: 'user-id',
};

it('SHOULD create the location', async () => {
  mocks.catalog.createLocation.mockResolvedValue(location('new'));

  await setup.execute(input);

  expect(mocks.catalog.createLocation).toHaveBeenCalledWith({
    color: '#F59E0B',
    icon: 'archive',
    name: 'Pantry',
    owner: 'USER',
    ownerId: 'user-id',
    parentId: undefined,
  });
});

it('SHOULD refuse a name already used by the owner (case-insensitive) with 409', async () => {
  mocks.catalog.findLocations.mockResolvedValue([location('x', { name: 'PANTRY' })]);

  await expect(setup.execute(input)).rejects.toThrow(ConflictException);
});

it('SHOULD answer 404 for a foreign owner', async () => {
  await expect(setup.execute({ ...input, ownerId: 'other' })).rejects.toThrow(NotFoundException);
});

it('SHOULD allow the same name under another parent but not among siblings', async () => {
  mocks.catalog.createLocation.mockResolvedValue(location('new'));
  mocks.catalog.findLocations.mockResolvedValue([
    location('kitchen'),
    location('x', { name: 'Pantry', parentId: 'kitchen' }),
  ]);

  await expect(setup.execute(input)).resolves.toBeDefined();
  await expect(setup.execute({ ...input, parentId: 'kitchen' })).rejects.toThrow(ConflictException);
});

it('SHOULD create a sub-location under an active root', async () => {
  mocks.catalog.createLocation.mockResolvedValue(location('new'));
  mocks.catalog.findLocations.mockResolvedValue([location('kitchen')]);

  await setup.execute({ ...input, name: 'Fridge', parentId: 'kitchen' });

  expect(mocks.catalog.createLocation).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Fridge', parentId: 'kitchen' }),
  );
});

it.each([
  ['an unknown parent', [], 'x'],
  ['an archived parent', [location('p', { status: StockCatalogStatus.ARCHIVED })], 'p'],
  ['a third level', [location('a'), location('b', { parentId: 'a' })], 'b'],
])('SHOULD refuse %s with 422', async (_label, existing, parentId) => {
  mocks.catalog.findLocations.mockResolvedValue(existing);

  await expect(setup.execute({ ...input, parentId })).rejects.toThrow(UnprocessableEntityException);
  expect(mocks.catalog.createLocation).not.toHaveBeenCalled();
});

it('SHOULD refuse an icon missing from the catalog with 422', async () => {
  await expect(setup.execute({ ...input, icon: 'nope', iconCatalog: ['cart'] })).rejects.toThrow(
    UnprocessableEntityException,
  );
});
