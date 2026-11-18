import { mocks, setup, spies } from './index.mocks';

describe('counts', () => {
  it('SHOULD group the items of the owner by category and by location', async () => {
    spies.itemGroupBy.mockResolvedValueOnce([{ _count: { _all: 3 }, category_id: 'c' }]);
    spies.itemGroupBy.mockResolvedValueOnce([{ _count: { _all: 2 }, location_id: 'l' }]);

    expect(await setup.countItemsByCategory(mocks.key)).toEqual([{ category_id: 'c', count: 3 }]);
    expect(await setup.countItemsByLocation(mocks.key)).toEqual([{ count: 2, location_id: 'l' }]);
    expect(spies.itemGroupBy.mock.calls[0][0]).toMatchObject({
      by: ['category_id'],
      where: { ...mocks.key, category_id: { not: null } },
    });
  });
});

describe('categories', () => {
  it('SHOULD create one and many (in one transaction)', async () => {
    spies.categoryCreate.mockImplementation(async ({ data }) => data);

    expect(await setup.createCategory({ ...mocks.key, name: 'A' })).toMatchObject({ name: 'A' });
    expect(
      await setup.createCategories([
        { ...mocks.key, name: 'B' },
        { ...mocks.key, name: 'C' },
      ]),
    ).toHaveLength(2);
    expect(spies.transaction).toHaveBeenCalledTimes(1);
  });

  it('SHOULD find by owner (name order) and by id', async () => {
    await setup.findCategories(mocks.key);
    await setup.findCategoryById('c');

    expect(spies.categoryFindMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      where: mocks.key,
    });
    expect(spies.categoryFindUnique).toHaveBeenCalledWith({ where: { id: 'c' } });
  });

  it('SHOULD update the columns, set the status of many ids and delete without failing for a missing row', async () => {
    await setup.updateCategory({ finance_category_id: null, id: 'c', name: 'N' });
    await setup.setCategoryStatus(['a', 'b'], 'ARCHIVED');
    await setup.deleteCategory('c');

    expect(spies.categoryUpdate).toHaveBeenCalledWith({
      data: { finance_category_id: null, name: 'N' },
      where: { id: 'c' },
    });
    expect(spies.categoryUpdateMany).toHaveBeenCalledWith({
      data: { status: 'ARCHIVED' },
      where: { id: { in: ['a', 'b'] } },
    });
    expect(spies.categoryDeleteMany).toHaveBeenCalledWith({ where: { id: 'c' } });
  });
});

describe('locations', () => {
  it('SHOULD create one and many', async () => {
    spies.locationCreate.mockImplementation(async ({ data }) => data);

    expect(await setup.createLocation({ ...mocks.key, name: 'A' })).toMatchObject({ name: 'A' });
    expect(await setup.createLocations([{ ...mocks.key, name: 'B' }])).toHaveLength(1);
  });

  it('SHOULD find, update and delete', async () => {
    await setup.findLocations(mocks.key);
    await setup.findLocationById('l');
    await setup.updateLocation({ id: 'l', status: 'ARCHIVED' });
    await setup.deleteLocation('l');

    expect(spies.locationFindMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      where: mocks.key,
    });
    expect(spies.locationFindUnique).toHaveBeenCalledWith({ where: { id: 'l' } });
    expect(spies.locationUpdate).toHaveBeenCalledWith({
      data: { status: 'ARCHIVED' },
      where: { id: 'l' },
    });
    expect(spies.locationDeleteMany).toHaveBeenCalledWith({ where: { id: 'l' } });
  });
});

it('SHOULD purge the categories and locations of an owner in one transaction', async () => {
  await setup.deleteByOwner(mocks.key);

  expect(spies.categoryDeleteMany).toHaveBeenCalledWith({ where: mocks.key });
  expect(spies.locationDeleteMany).toHaveBeenCalledWith({ where: mocks.key });
  expect(spies.transaction).toHaveBeenCalledTimes(1);
});

it('SHOULD read the categories and locations of several owners in two statements', async () => {
  spies.categoryFindMany.mockResolvedValue([{ id: 'c' }]);
  spies.locationFindMany.mockResolvedValue([{ id: 'l' }]);
  spies.shoppingListFindMany.mockResolvedValue([{ id: 's' }]);

  expect(await setup.findCatalogByOwners([mocks.key, { owner: 'FAMILY', owner_id: 'f' }])).toEqual({
    categories: [{ id: 'c' }],
    locations: [{ id: 'l' }],
    shopping_lists: [{ id: 's' }],
  });
  expect(spies.shoppingListFindMany).toHaveBeenCalledWith({
    orderBy: { name: 'asc' },
    where: { OR: [mocks.key, { owner: 'FAMILY', owner_id: 'f' }], status: 'ACTIVE' },
  });
  expect(spies.categoryFindMany).toHaveBeenCalledWith({
    orderBy: { name: 'asc' },
    where: { OR: [mocks.key, { owner: 'FAMILY', owner_id: 'f' }] },
  });
});
