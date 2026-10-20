import { mocks, setup, spies } from './index.mocks';

describe('Method create', () => {
  it('SHOULD insert the tag AND nest the scope rows WHEN ALL', async () => {
    spies.create.mockResolvedValue(mocks.tag);
    const scopes = [{ owner: 'FAMILY' as const, owner_id: 'family-id' }];
    const params = {
      all_scopes: true,
      creator_id: mocks.ownerId,
      name: 'gasto-fixo',
      owner: 'USER' as const,
      owner_id: mocks.ownerId,
    };

    await setup.create({ ...params, scopes });
    await setup.create(params);

    expect(spies.create).toHaveBeenNthCalledWith(1, {
      data: { ...params, scopes: { create: scopes } },
      include: { scopes: true },
    });
    expect(spies.create).toHaveBeenNthCalledWith(2, { data: params, include: { scopes: true } });
  });
});

describe('Method delete / exists / findById / removeScope', () => {
  it('SHOULD delegate to Prisma', async () => {
    spies.findFirst.mockResolvedValue({ id: 'x' });
    spies.findUnique.mockResolvedValue(mocks.tag);

    await setup.delete('id-1');
    await setup.removeScope({ owner: 'FAMILY', owner_id: 'fam' });

    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: 'id-1' } });
    expect(spies.scopeDeleteMany).toHaveBeenCalledWith({
      where: { owner: 'FAMILY', owner_id: 'fam' },
    });
    expect(await setup.exists({ owner: 'USER', owner_id: 'u' })).toBe(true);
    expect(await setup.findById('id-1')).toBe(mocks.tag);
  });
});

describe('Method addScope', () => {
  it('SHOULD give every ALL tag of the creator the scope row, skipping duplicates', async () => {
    spies.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);

    await setup.addScope({ creator_id: 'c', owner: 'FAMILY', owner_id: 'fam' });

    expect(spies.scopeCreateMany).toHaveBeenCalledWith({
      data: [
        { owner: 'FAMILY', owner_id: 'fam', tag_id: 't1' },
        { owner: 'FAMILY', owner_id: 'fam', tag_id: 't2' },
      ],
      skipDuplicates: true,
    });
  });
});

describe('Method countUsage', () => {
  it('SHOULD sum transaction and recurrence links per tag', async () => {
    spies.groupByTransaction.mockResolvedValue([{ _count: { _all: 2 }, tag_id: 't1' }]);
    spies.groupByRecurrence.mockResolvedValue([
      { _count: { _all: 1 }, tag_id: 't1' },
      { _count: { _all: 4 }, tag_id: 't2' },
    ]);

    const usage = await setup.countUsage(['t1', 't2'], mocks.owners);

    expect(usage.get('t1')).toBe(3);
    expect(usage.get('t2')).toBe(4);
  });

  it('SHOULD skip the queries WHEN there is nothing to count', async () => {
    expect((await setup.countUsage([], mocks.owners)).size).toBe(0);
    expect(spies.groupByTransaction).not.toHaveBeenCalled();
  });
});

describe('Method findByOwners', () => {
  it('SHOULD query single-scope rows by owner AND ALL rows by scope, with the name filter', async () => {
    spies.findMany.mockResolvedValue([mocks.tag]);

    await setup.findByOwners({ owners: mocks.owners, q: 'gas' });

    expect(spies.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { scopes: true },
        where: expect.objectContaining({
          name: { contains: 'gas', mode: 'insensitive' },
          OR: expect.any(Array),
        }),
      }),
    );
  });
});

describe('Method findConflicts', () => {
  it('SHOULD match the name ignoring case AND exclude the given id', async () => {
    spies.findMany.mockResolvedValue([]);

    await setup.findConflicts({ exclude_id: 'me', name: 'Gasto', scopes: mocks.owners });

    expect(spies.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'me' },
          name: { equals: 'Gasto', mode: 'insensitive' },
        }),
      }),
    );
  });
});

describe('Method update', () => {
  it('SHOULD rename AND return the tag with its scopes', async () => {
    spies.findUniqueOrThrow.mockResolvedValue(mocks.tag);

    expect(await setup.update({ id: 'id-1', name: 'novo' })).toBe(mocks.tag);
    expect(spies.update).toHaveBeenCalledWith({ data: { name: 'novo' }, where: { id: 'id-1' } });
    expect(spies.scopeCreateMany).not.toHaveBeenCalled();
  });

  it('SHOULD switch to ALL and replace the scope rows', async () => {
    spies.findUniqueOrThrow.mockResolvedValue(mocks.tag);
    const scopes = [{ owner: 'USER' as const, owner_id: 'c' }];

    await setup.update({ id: 'id-1', scope: { creator_id: 'c', scopes } });

    expect(spies.update).toHaveBeenCalledWith({
      data: { all_scopes: true, creator_id: 'c', name: undefined, owner: 'USER', owner_id: 'c' },
      where: { id: 'id-1' },
    });
    expect(spies.scopeDeleteMany).toHaveBeenCalledWith({ where: { tag_id: 'id-1' } });
    expect(spies.scopeCreateMany).toHaveBeenCalledWith({
      data: [{ owner: 'USER', owner_id: 'c', tag_id: 'id-1' }],
    });
  });
});

describe('Method detachFamilyScope', () => {
  it('SHOULD copy the ALL tags, merge into a same-name family tag, repoint links AND drop the scope', async () => {
    spies.findMany
      .mockResolvedValueOnce([
        { id: 'all-1', name: 'Viagem' },
        { id: 'all-2', name: 'Gasto-Fixo' },
      ])
      .mockResolvedValueOnce([{ id: 'own-2', name: 'gasto-fixo' }]);
    spies.create.mockResolvedValue({ id: 'copy-1' });
    spies.trLinkFindMany.mockResolvedValue([{ position: 0, transaction_id: 'tr-1' }]);
    spies.recLinkFindMany.mockResolvedValue([{ position: 1, recurrence_id: 'rec-1' }]);

    const copied = await setup.detachFamilyScope({ creator_id: 'c', family_id: 'fam' });

    expect(copied).toBe(2);
    expect(spies.create).toHaveBeenCalledTimes(1);
    expect(spies.create).toHaveBeenCalledWith({
      data: {
        all_scopes: false,
        creator_id: 'fam',
        name: 'Viagem',
        owner: 'FAMILY',
        owner_id: 'fam',
      },
      select: { id: true },
    });
    expect(spies.trLinkCreateMany).toHaveBeenCalledWith({
      data: [{ position: 0, tag_id: 'copy-1', transaction_id: 'tr-1' }],
      skipDuplicates: true,
    });
    expect(spies.recLinkCreateMany).toHaveBeenCalledWith({
      data: [{ position: 1, recurrence_id: 'rec-1', tag_id: 'copy-1' }],
      skipDuplicates: true,
    });
    expect(spies.scopeDeleteMany).toHaveBeenCalledWith({
      where: { owner: 'FAMILY', owner_id: 'fam', tag_id: { in: ['all-1', 'all-2'] } },
    });
  });
});
