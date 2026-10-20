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
      owner_id: mocks.ownerId,
      parent_id: 'parent-id',
      type: 'EXPENSE' as const,
    };

    expect(await setup.create(params)).toEqual(mocks.category);
    expect(spies.create).toHaveBeenCalledWith({ data: params, include: { scopes: true } });
  });

  it('SHOULD create the scope rows nested WHEN the category is ALL', async () => {
    spies.create.mockResolvedValue(mocks.category);
    const scopes = [
      { owner: 'USER' as const, owner_id: mocks.ownerId },
      { owner: 'FAMILY' as const, owner_id: 'family-id' },
    ];
    const params = {
      all_scopes: true,
      creator_id: mocks.ownerId,
      depth_level: 0,
      icon: 'cart',
      icon_color: '#2E7D32',
      name: 'Groceries',
      owner: 'USER' as const,
      owner_id: mocks.ownerId,
      type: 'EXPENSE' as const,
    };

    await setup.create({ ...params, scopes });

    expect(spies.create).toHaveBeenCalledWith({
      data: { ...params, scopes: { create: scopes } },
      include: { scopes: true },
    });
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
    expect(spies.findUnique).toHaveBeenCalledWith({
      include: { scopes: true },
      where: { id: mocks.category.id },
    });
  });
});

describe('Method findByOwners', () => {
  const ownerWhere = { OR: [{ owner: 'USER', owner_id: mocks.owners[0].ownerId }] };
  const where = {
    OR: [
      { all_scopes: false, ...ownerWhere },
      { all_scopes: true, scopes: { some: ownerWhere } },
    ],
  };

  it('SHOULD query the owners WITHOUT a type filter by default', async () => {
    spies.findMany.mockResolvedValue([mocks.category]);

    expect(await setup.findByOwners({ owners: mocks.owners })).toEqual([mocks.category]);
    expect(spies.findMany).toHaveBeenCalledWith({ include: { scopes: true }, where });
  });

  it('SHOULD add the type filter WHEN requested', async () => {
    spies.findMany.mockResolvedValue([]);

    await setup.findByOwners({ owners: mocks.owners, type: 'INCOME' });

    expect(spies.findMany).toHaveBeenCalledWith({
      include: { scopes: true },
      where: { ...where, type: 'INCOME' },
    });
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
      include: { scopes: true },
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
      include: { scopes: true },
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

describe('Method update › status (spec 041)', () => {
  it('SHOULD change the status of the category AND its subtree in ONE $transaction', async () => {
    spies.update.mockReturnValueOnce('self-op');
    spies.updateMany.mockReturnValueOnce('status-op');
    spies.transaction.mockResolvedValue([mocks.category, {}]);

    await setup.update({ id: 'root', status: 'ARCHIVED', subtree_ids: ['child', 'grandchild'] });

    expect(spies.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ARCHIVED' }) }),
    );
    expect(spies.updateMany).toHaveBeenCalledWith({
      data: { status: 'ARCHIVED' },
      where: { id: { in: ['child', 'grandchild'] } },
    });
    expect(spies.transaction).toHaveBeenCalledWith(['self-op', 'status-op']);
  });

  it('SHOULD NOT update other categories WHEN the subtree is empty', async () => {
    spies.update.mockReturnValueOnce('self-op');
    spies.transaction.mockResolvedValue([mocks.category]);

    await setup.update({ id: 'leaf', status: 'ARCHIVED', subtree_ids: [] });

    expect(spies.updateMany).not.toHaveBeenCalled();
  });
});

describe('Method update › switch to ALL', () => {
  it('SHOULD flag the category and its subtree, replace their scope rows AND read the result back', async () => {
    spies.update.mockReturnValueOnce('self-op');
    spies.updateMany.mockReturnValueOnce('flag-op');
    spies.deleteManyScope.mockReturnValueOnce('delete-op');
    spies.createManyScope.mockReturnValueOnce('create-op');
    spies.transaction.mockResolvedValue([mocks.category]);
    spies.findUniqueOrThrow.mockResolvedValue({ ...mocks.category, all_scopes: true });
    const scopes = [
      { owner: 'USER' as const, owner_id: 'creator' },
      { owner: 'FAMILY' as const, owner_id: 'family' },
    ];

    const result = await setup.update({
      id: 'root',
      scope: { creator_id: 'creator', scopes, subtree_ids: ['child'] },
    });

    expect(spies.updateMany).toHaveBeenCalledWith({
      data: { all_scopes: true, creator_id: 'creator', owner: 'USER', owner_id: 'creator' },
      where: { id: { in: ['root', 'child'] } },
    });
    expect(spies.deleteManyScope).toHaveBeenCalledWith({
      where: { category_id: { in: ['root', 'child'] } },
    });
    expect(spies.createManyScope).toHaveBeenCalledWith({
      data: [
        { category_id: 'root', owner: 'USER', owner_id: 'creator' },
        { category_id: 'root', owner: 'FAMILY', owner_id: 'family' },
        { category_id: 'child', owner: 'USER', owner_id: 'creator' },
        { category_id: 'child', owner: 'FAMILY', owner_id: 'family' },
      ],
    });
    expect(spies.transaction).toHaveBeenCalledWith([
      'self-op',
      'flag-op',
      'delete-op',
      'create-op',
    ]);
    expect(result.all_scopes).toBe(true);
  });
});

describe('Method addScope', () => {
  it('SHOULD add the scope to every ALL category of the creator, skipping duplicates', async () => {
    spies.txCategoryFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    await setup.addScope({ creator_id: 'creator', owner: 'FAMILY', owner_id: 'family' });

    expect(spies.txCategoryFindMany).toHaveBeenCalledWith({
      select: { id: true },
      where: { all_scopes: true, creator_id: 'creator' },
    });
    expect(spies.createManyScope).toHaveBeenCalledWith({
      data: [
        { category_id: 'a', owner: 'FAMILY', owner_id: 'family' },
        { category_id: 'b', owner: 'FAMILY', owner_id: 'family' },
      ],
      skipDuplicates: true,
    });
  });
});

describe('Method removeScope', () => {
  it('SHOULD delete every scope row of the owner', async () => {
    await setup.removeScope({ owner: 'FAMILY', owner_id: 'family' });

    expect(spies.deleteManyScope).toHaveBeenCalledWith({
      where: { owner: 'FAMILY', owner_id: 'family' },
    });
  });
});

describe('Method detachFamilyScope', () => {
  const familyScope = { owner: 'FAMILY', owner_id: 'family' };

  it('SHOULD copy the tree keeping the parent link, repoint the family records AND drop the scope', async () => {
    spies.txCategoryFindMany.mockResolvedValue([
      { ...mocks.category, depth_level: 0, id: 'root', parent_id: null },
      { ...mocks.category, depth_level: 1, id: 'child', parent_id: 'root' },
    ]);
    spies.createCategoryTx
      .mockResolvedValueOnce({ id: 'root-copy' })
      .mockResolvedValueOnce({ id: 'child-copy' });

    const copied = await setup.detachFamilyScope({ creator_id: 'creator', family_id: 'family' });

    expect(copied).toBe(2);
    expect(spies.txCategoryFindMany).toHaveBeenCalledWith({
      orderBy: { depth_level: 'asc' },
      where: { all_scopes: true, creator_id: 'creator', scopes: { some: familyScope } },
    });
    expect(spies.createCategoryTx).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          all_scopes: false,
          owner: 'FAMILY',
          owner_id: 'family',
          parent_id: undefined,
        }),
      }),
    );
    expect(spies.createCategoryTx).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ depth_level: 1, parent_id: 'root-copy' }),
      }),
    );
    // transactions, installment plans and recurrences, for each of the two categories
    expect(spies.recordsUpdateMany).toHaveBeenCalledTimes(6);
    expect(spies.recordsUpdateMany).toHaveBeenCalledWith({
      data: { category_id: 'child-copy' },
      where: { category_id: 'child', ...familyScope },
    });
    expect(spies.deleteManyScope).toHaveBeenCalledWith({
      where: { category_id: { in: ['root', 'child'] }, ...familyScope },
    });
  });

  it('SHOULD do nothing WHEN no ALL category carries the family scope (idempotent)', async () => {
    spies.txCategoryFindMany.mockResolvedValue([]);

    expect(await setup.detachFamilyScope({ creator_id: 'creator', family_id: 'family' })).toBe(0);
    expect(spies.createCategoryTx).not.toHaveBeenCalled();
    expect(spies.recordsUpdateMany).not.toHaveBeenCalled();
  });
});
