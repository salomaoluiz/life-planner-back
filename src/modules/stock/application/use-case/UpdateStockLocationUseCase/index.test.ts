import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

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

it('SHOULD rename and archive with the sub-locations', async () => {
  mocks.catalog.findLocations.mockResolvedValue([
    location('a', { name: 'Pantry' }),
    location('sub', { name: 'Shelf', parentId: 'a' }),
  ]);

  const updated = await setup.execute({
    ...input,
    name: 'Garage',
    status: StockCatalogStatus.ARCHIVED,
  });

  expect(mocks.catalog.updateLocation).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'a', name: 'Garage' }),
  );
  expect(mocks.catalog.setLocationStatus).toHaveBeenCalledWith(['a', 'sub'], 'ARCHIVED');
  expect(updated.status).toBe('ARCHIVED');
});

it('SHOULD allow keeping its own name', async () => {
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

describe('WHEN the appearance or the parent changes', () => {
  beforeEach(() => {
    mocks.catalog.findLocations.mockResolvedValue([
      location('a', { name: 'Pantry' }),
      location('sub', { name: 'Shelf', parentId: 'a' }),
      location('b', { name: 'Fridge' }),
      location('arch', { name: 'Old', status: StockCatalogStatus.ARCHIVED }),
    ]);
  });

  it('SHOULD push the icon and tones to the active sub-locations only', async () => {
    await setup.execute({
      ...input,
      applyToChildren: true,
      childColors: { sub: '#112233' },
      color: '#445566',
      icon: 'fridge',
    });

    expect(mocks.catalog.updateLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        cascade: { colors: { sub: '#112233' }, icon: 'fridge', ids: ['sub'] },
        color: '#445566',
        icon: 'fridge',
      }),
    );
  });

  it('SHOULD refuse an unknown icon, a parent under itself, a third level and an archived parent', async () => {
    await expect(setup.execute({ ...input, icon: 'nope', iconCatalog: ['cart'] })).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(setup.execute({ ...input, parentId: 'sub' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(setup.execute({ ...input, parentId: 'b' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(setup.execute({ ...input, parentId: 'arch' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(setup.execute({ ...input, parentId: 'missing' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('SHOULD move a childless location under a root', async () => {
    mocks.catalog.findLocationById.mockResolvedValue(location('b', { name: 'Fridge' }));

    await setup.execute({ ...input, id: 'b', parentId: 'a' });

    expect(mocks.catalog.updateLocation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b', parentId: 'a' }),
    );
  });

  it('SHOULD refuse to reactivate a sub-location whose parent is archived', async () => {
    mocks.catalog.findLocationById.mockResolvedValue(
      location('sub', { parentId: 'arch', status: StockCatalogStatus.ARCHIVED }),
    );
    mocks.catalog.findLocations.mockResolvedValue([
      location('arch', { status: StockCatalogStatus.ARCHIVED }),
      location('sub', { parentId: 'arch', status: StockCatalogStatus.ARCHIVED }),
    ]);

    await expect(
      setup.execute({ ...input, id: 'sub', status: StockCatalogStatus.ACTIVE }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
