import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { datasource, setup } from './index.mocks';

const owner = { owner: OwnerType.USER, ownerId: 'user' };
const key = { owner: 'USER', owner_id: 'user' };

it('SHOULD turn the counts into maps', async () => {
  datasource.countItemsByCategory.mockResolvedValue([{ category_id: 'c', count: 2 }]);
  datasource.countItemsByLocation.mockResolvedValue([{ count: 1, location_id: 'l' }]);

  expect(await setup.countItemsByCategory(owner)).toEqual(new Map([['c', 2]]));
  expect(await setup.countItemsByLocation(owner)).toEqual(new Map([['l', 1]]));
  expect(datasource.countItemsByCategory).toHaveBeenCalledWith(key);
});

it('SHOULD create categories (one and many) translating the columns AND map them', async () => {
  datasource.createCategory.mockResolvedValue({});
  datasource.createCategories.mockResolvedValue([{}, {}]);
  const params = {
    financeCategoryId: 'f',
    name: 'Dairy',
    owner: OwnerType.USER,
    ownerId: 'user',
    parentId: 'p',
  };

  expect(await setup.createCategory(params)).toEqual({ id: 'category' });
  expect(datasource.createCategory).toHaveBeenCalledWith({
    finance_category_id: 'f',
    name: 'Dairy',
    owner: 'USER',
    owner_id: 'user',
    parent_id: 'p',
  });
  expect(await setup.createCategories([params, params])).toHaveLength(2);
});

it('SHOULD create locations (one and many) AND map them', async () => {
  datasource.createLocation.mockResolvedValue({});
  datasource.createLocations.mockResolvedValue([{}]);
  const params = { name: 'Pantry', owner: OwnerType.USER, ownerId: 'user' };

  expect(await setup.createLocation(params)).toEqual({ id: 'location' });
  expect(await setup.createLocations([params])).toEqual([{ id: 'location' }]);
  expect(datasource.createLocation).toHaveBeenCalledWith({
    name: 'Pantry',
    owner: 'USER',
    owner_id: 'user',
  });
});

it('SHOULD delegate deletes and the purge by owner', async () => {
  await setup.deleteByOwner(owner);
  await setup.deleteCategory('c');
  await setup.deleteLocation('l');

  expect(datasource.deleteByOwner).toHaveBeenCalledWith(key);
  expect(datasource.deleteCategory).toHaveBeenCalledWith('c');
  expect(datasource.deleteLocation).toHaveBeenCalledWith('l');
});

it('SHOULD find and map, returning undefined for a missing row', async () => {
  datasource.findCategories.mockResolvedValue([{}]);
  datasource.findLocations.mockResolvedValue([{}]);
  datasource.findCategoryById.mockResolvedValueOnce({}).mockResolvedValueOnce(null);
  datasource.findLocationById.mockResolvedValueOnce({}).mockResolvedValueOnce(null);

  expect(await setup.findCategories(owner)).toEqual([{ id: 'category' }]);
  expect(await setup.findLocations(owner)).toEqual([{ id: 'location' }]);
  expect(await setup.findCategoryById('c')).toEqual({ id: 'category' });
  expect(await setup.findCategoryById('c')).toBeUndefined();
  expect(await setup.findLocationById('l')).toEqual({ id: 'location' });
  expect(await setup.findLocationById('l')).toBeUndefined();
});

it('SHOULD update and set statuses', async () => {
  datasource.updateCategory.mockResolvedValue({});
  datasource.updateLocation.mockResolvedValue({});

  expect(
    await setup.updateCategory({ financeCategoryId: null, id: 'c', name: 'N', parentId: 'p' }),
  ).toEqual({ id: 'category' });
  expect(datasource.updateCategory).toHaveBeenCalledWith({
    finance_category_id: null,
    id: 'c',
    name: 'N',
    parent_id: 'p',
  });
  expect(await setup.updateLocation({ id: 'l', status: StockCatalogStatus.ARCHIVED })).toEqual({
    id: 'location',
  });
  expect(datasource.updateLocation).toHaveBeenCalledWith({
    id: 'l',
    name: undefined,
    status: 'ARCHIVED',
  });

  await setup.setCategoryStatus(['a'], StockCatalogStatus.ACTIVE);
  expect(datasource.setCategoryStatus).toHaveBeenCalledWith(['a'], 'ACTIVE');
});

it('SHOULD read the catalog of several owners at once AND map both lists', async () => {
  datasource.findCatalogByOwners.mockResolvedValue({ categories: [{}], locations: [{}, {}] });

  const result = await setup.findCatalogByOwners([owner]);

  expect(datasource.findCatalogByOwners).toHaveBeenCalledWith([key]);
  expect(result.categories).toEqual([{ id: 'category' }]);
  expect(result.locations).toHaveLength(2);
});
