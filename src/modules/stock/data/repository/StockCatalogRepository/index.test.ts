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
    color: '#112233',
    financeCategoryId: 'f',
    icon: 'cart',
    name: 'Dairy',
    owner: OwnerType.USER,
    ownerId: 'user',
    parentId: 'p',
  };

  expect(await setup.createCategory(params)).toEqual({ id: 'category' });
  expect(datasource.createCategory).toHaveBeenCalledWith({
    color: '#112233',
    finance_category_id: 'f',
    icon: 'cart',
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
  const params = {
    color: '#112233',
    icon: 'archive',
    name: 'Pantry',
    owner: OwnerType.USER,
    ownerId: 'user',
    parentId: 'p',
  };

  expect(await setup.createLocation(params)).toEqual({ id: 'location' });
  expect(await setup.createLocations([params])).toEqual([{ id: 'location' }]);
  expect(datasource.createLocation).toHaveBeenCalledWith({
    color: '#112233',
    icon: 'archive',
    name: 'Pantry',
    owner: 'USER',
    owner_id: 'user',
    parent_id: 'p',
  });
});

it('SHOULD delegate deletes and the purge by owner', async () => {
  await setup.deleteByOwner(owner);
  await setup.deleteCategory('c', { from: ['c'], to: 'o' });
  await setup.deleteLocation('l');

  expect(datasource.deleteByOwner).toHaveBeenCalledWith(key);
  expect(datasource.deleteCategory).toHaveBeenCalledWith('c', { from: ['c'], to: 'o' });
  expect(datasource.deleteLocation).toHaveBeenCalledWith('l', undefined);
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
    cascade: undefined,
    color: undefined,
    finance_category_id: null,
    icon: undefined,
    id: 'c',
    name: 'N',
    parent_id: 'p',
  });
  expect(
    await setup.updateLocation({
      cascade: { colors: {}, ids: ['k'] },
      color: '#112233',
      icon: 'fridge',
      id: 'l',
      parentId: null,
    }),
  ).toEqual({ id: 'location' });
  expect(datasource.updateLocation).toHaveBeenCalledWith({
    cascade: { colors: {}, ids: ['k'] },
    color: '#112233',
    icon: 'fridge',
    id: 'l',
    name: undefined,
    parent_id: null,
  });

  await setup.setCategoryStatus(['a'], StockCatalogStatus.ACTIVE);
  expect(datasource.setCategoryStatus).toHaveBeenCalledWith(['a'], 'ACTIVE');

  await setup.setLocationStatus(['b'], StockCatalogStatus.ARCHIVED);
  expect(datasource.setLocationStatus).toHaveBeenCalledWith(['b'], 'ARCHIVED');
});

it('SHOULD read the catalog of several owners at once AND map both lists', async () => {
  datasource.findCatalogByOwners.mockResolvedValue({
    categories: [{}],
    locations: [{}, {}],
    shopping_lists: [{}],
  });

  const result = await setup.findCatalogByOwners([owner]);

  expect(datasource.findCatalogByOwners).toHaveBeenCalledWith([key]);
  expect(result.categories).toEqual([{ id: 'category' }]);
  expect(result.locations).toHaveLength(2);
  expect(result.shoppingLists).toEqual([{ id: 'list' }]);
});
