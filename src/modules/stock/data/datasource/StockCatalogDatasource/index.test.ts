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

    expect(
      await setup.createCategory({ ...mocks.key, color: '#112233', icon: 'cart', name: 'A' }),
    ).toMatchObject({ name: 'A' });
    expect(
      await setup.createCategories([
        { ...mocks.key, color: '#112233', icon: 'cart', name: 'B' },
        { ...mocks.key, color: '#112233', icon: 'cart', name: 'C' },
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

    expect(
      await setup.createLocation({ ...mocks.key, color: '#112233', icon: 'archive', name: 'A' }),
    ).toMatchObject({ name: 'A' });
    expect(
      await setup.createLocations([{ ...mocks.key, color: '#112233', icon: 'archive', name: 'B' }]),
    ).toHaveLength(1);
  });

  it('SHOULD find, update and delete', async () => {
    await setup.findLocations(mocks.key);
    await setup.findLocationById('l');
    await setup.updateLocation({ id: 'l', name: 'N' });
    await setup.deleteLocation('l');

    expect(spies.locationFindMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      where: mocks.key,
    });
    expect(spies.locationFindUnique).toHaveBeenCalledWith({ where: { id: 'l' } });
    expect(spies.locationUpdate).toHaveBeenCalledWith({
      data: { name: 'N' },
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

describe('delete with move (spec 125 FR 22)', () => {
  it('SHOULD move the items of the subtree and delete the category in one transaction', async () => {
    await setup.deleteCategory('c', { from: ['c', 'k'], to: 'other' });

    expect(spies.itemUpdateMany).toHaveBeenCalledWith({
      data: { category_id: 'other' },
      where: { category_id: { in: ['c', 'k'] } },
    });
    expect(spies.categoryDeleteMany).toHaveBeenCalledWith({ where: { id: 'c' } });
    expect(spies.transaction).toHaveBeenCalledTimes(1);
  });

  it('SHOULD clear the location of the items WHEN the target is none', async () => {
    await setup.deleteLocation('l', { from: ['l'], to: null });

    expect(spies.itemUpdateMany).toHaveBeenCalledWith({
      data: { location_id: null },
      where: { location_id: { in: ['l'] } },
    });
    expect(spies.locationDeleteMany).toHaveBeenCalledWith({ where: { id: 'l' } });
  });
});

describe('appearance cascade (spec 125 FR 12)', () => {
  const cascade = { colors: { k1: '#111111', k2: '#222222' }, icon: 'fridge', ids: ['k1', 'k2'] };

  it('SHOULD update the category and push the icon and each tone in the same transaction', async () => {
    await setup.updateCategory({ cascade, color: '#000000', icon: 'fridge', id: 'c' });

    expect(spies.categoryUpdate).toHaveBeenCalledWith({
      data: { color: '#000000', icon: 'fridge' },
      where: { id: 'c' },
    });
    expect(spies.categoryUpdateMany).toHaveBeenCalledWith({
      data: { icon: 'fridge' },
      where: { id: { in: ['k1', 'k2'] } },
    });
    expect(spies.categoryUpdateMany).toHaveBeenCalledWith({
      data: { color: '#222222' },
      where: { id: { in: ['k2'] } },
    });
    expect(spies.transaction).toHaveBeenCalledTimes(1);
  });

  it('SHOULD do the same for a location and set the status of many', async () => {
    await setup.updateLocation({ cascade, id: 'l' });
    await setup.setLocationStatus(['l', 'k1'], 'ARCHIVED');

    expect(spies.locationUpdateMany).toHaveBeenCalledWith({
      data: { icon: 'fridge' },
      where: { id: { in: ['k1', 'k2'] } },
    });
    expect(spies.locationUpdateMany).toHaveBeenCalledWith({
      data: { status: 'ARCHIVED' },
      where: { id: { in: ['l', 'k1'] } },
    });
  });

  it('SHOULD skip the icon write WHEN only tones were sent', async () => {
    await setup.updateCategory({ cascade: { colors: { k1: '#111111' }, ids: ['k1'] }, id: 'c' });

    expect(spies.categoryUpdateMany).toHaveBeenCalledTimes(1);
  });
});
