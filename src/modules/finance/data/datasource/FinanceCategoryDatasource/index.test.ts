import { mocks, setup, spies } from './index.mocks';

describe('Method create', () => {
  it('SHOULD insert the category AND return the row', async () => {
    spies.create.mockResolvedValue(mocks.category);
    const params = {
      depth_level: 1,
      icon: 'cart',
      icon_color: '#2E7D32',
      name: 'Groceries',
      owner: 'USER' as const,
      owner_id: mocks.category.owner_id,
      parent_id: 'parent-id',
      type: 'EXPENSE' as const,
    };

    expect(await setup.create(params)).toEqual(mocks.category);
    expect(spies.create).toHaveBeenCalledWith({ data: params });
  });
});

describe('Method delete', () => {
  it('SHOULD deleteMany by id (the FK cascade removes the subtree)', async () => {
    spies.deleteMany.mockResolvedValue({ count: 3 });

    await expect(setup.delete(mocks.category.id)).resolves.toBeUndefined();
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.category.id } });
  });
});

describe('Method exists', () => {
  it('SHOULD return true / false from a cheap findFirst on (owner, owner_id)', async () => {
    spies.findFirst.mockResolvedValueOnce({ id: 'x' }).mockResolvedValueOnce(null);
    const params = { owner: 'FAMILY' as const, owner_id: 'family-id' };

    expect(await setup.exists(params)).toBe(true);
    expect(await setup.exists(params)).toBe(false);
    expect(spies.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { owner: 'FAMILY', owner_id: 'family-id' },
    });
  });
});

describe('Method findById', () => {
  it('SHOULD return the row, or null WHEN not found', async () => {
    spies.findUnique.mockResolvedValueOnce(mocks.category).mockResolvedValueOnce(null);

    expect(await setup.findById(mocks.category.id)).toEqual(mocks.category);
    expect(await setup.findById('missing')).toBeNull();
    expect(spies.findUnique).toHaveBeenCalledWith({ where: { id: mocks.category.id } });
  });
});

describe('Method findByOwners', () => {
  const ownerWhere = { OR: [{ owner: 'USER', owner_id: mocks.owners[0].ownerId }] };

  it('SHOULD query the owners WITHOUT a type filter by default', async () => {
    spies.findMany.mockResolvedValue([mocks.category]);

    expect(await setup.findByOwners({ owners: mocks.owners })).toEqual([mocks.category]);
    expect(spies.findMany).toHaveBeenCalledWith({ where: ownerWhere });
  });

  it('SHOULD add the type filter WHEN requested', async () => {
    spies.findMany.mockResolvedValue([]);

    await setup.findByOwners({ owners: mocks.owners, type: 'INCOME' });

    expect(spies.findMany).toHaveBeenCalledWith({ where: { ...ownerWhere, type: 'INCOME' } });
  });
});

describe('Method update', () => {
  it('SHOULD update only the category WHEN there is no subtree change (still one transaction)', async () => {
    spies.update.mockReturnValueOnce('self-op');
    spies.transaction.mockResolvedValue([mocks.category]);

    const result = await setup.update({ id: mocks.category.id, name: 'Renamed' });

    expect(result).toEqual(mocks.category);
    expect(spies.update).toHaveBeenCalledTimes(1);
    expect(spies.update).toHaveBeenCalledWith({
      data: {
        depth_level: undefined,
        icon: undefined,
        icon_color: undefined,
        name: 'Renamed',
        parent_id: undefined,
        type: undefined,
      },
      where: { id: mocks.category.id },
    });
    expect(spies.transaction).toHaveBeenCalledWith(['self-op']);
  });

  it('SHOULD update the category AND every subtree depth in ONE $transaction, clearing the parent with null', async () => {
    spies.update
      .mockReturnValueOnce('self-op')
      .mockReturnValueOnce('child-op')
      .mockReturnValueOnce('grandchild-op');
    spies.transaction.mockResolvedValue([mocks.category, {}, {}]);

    const result = await setup.update({
      depth_level: 0,
      id: mocks.category.id,
      parent_id: null,
      subtree_depths: [
        { depth_level: 1, id: 'child' },
        { depth_level: 2, id: 'grandchild' },
      ],
    });

    expect(result).toEqual(mocks.category);
    expect(spies.update).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ depth_level: 0, parent_id: null }),
      where: { id: mocks.category.id },
    });
    expect(spies.update).toHaveBeenNthCalledWith(2, {
      data: { depth_level: 1 },
      where: { id: 'child' },
    });
    expect(spies.update).toHaveBeenNthCalledWith(3, {
      data: { depth_level: 2 },
      where: { id: 'grandchild' },
    });
    expect(spies.transaction).toHaveBeenCalledTimes(1);
    expect(spies.transaction).toHaveBeenCalledWith(['self-op', 'child-op', 'grandchild-op']);
  });
});
