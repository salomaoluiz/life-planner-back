import { mocks, setup, spies } from './index.mocks';

describe('Method countByAccountId / countByCategoryIds', () => {
  it('SHOULD count the transactions of an account', async () => {
    spies.count.mockResolvedValue(3);

    expect(await setup.countByAccountId('acc-1')).toBe(3);
    expect(spies.count).toHaveBeenCalledWith({ where: { account_id: 'acc-1' } });
  });

  it('SHOULD count the transactions of ANY of the given categories in one query', async () => {
    spies.count.mockResolvedValue(1);

    expect(await setup.countByCategoryIds(['c1', 'c2'])).toBe(1);
    expect(spies.count).toHaveBeenCalledWith({ where: { category_id: { in: ['c1', 'c2'] } } });
  });
});

describe('Method create', () => {
  it('SHOULD insert AND return the row with the account / category summaries (one query)', async () => {
    spies.create.mockResolvedValue(mocks.transaction);
    const params = {
      account_id: mocks.transaction.account_id,
      category_id: mocks.transaction.category_id,
      date: new Date('2026-10-03T00:00:00.000Z'),
      description: 'Weekly groceries',
      owner: 'USER' as const,
      owner_id: mocks.transaction.owner_id,
      type: 'EXPENSE' as const,
      value: 23490,
    };

    expect(await setup.create(params)).toEqual(mocks.transaction);
    expect(spies.create).toHaveBeenCalledWith({ data: params, include: mocks.include });
  });
});

describe('Method delete', () => {
  it('SHOULD deleteMany by id without failing WHEN the row is already gone', async () => {
    spies.deleteMany.mockResolvedValue({ count: 0 });

    await expect(setup.delete(mocks.transaction.id)).resolves.toBeUndefined();
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.transaction.id } });
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
  it('SHOULD return the row with relations, or null WHEN not found', async () => {
    spies.findUnique.mockResolvedValueOnce(mocks.transaction).mockResolvedValueOnce(null);

    expect(await setup.findById(mocks.transaction.id)).toEqual(mocks.transaction);
    expect(await setup.findById('missing')).toBeNull();
    expect(spies.findUnique).toHaveBeenCalledWith({
      include: mocks.include,
      where: { id: mocks.transaction.id },
    });
  });
});

describe('Method findByOwners', () => {
  it('SHOULD query every owner in ONE findMany, joined, sorted by date desc then created_at desc', async () => {
    spies.findMany.mockResolvedValue([mocks.transaction]);

    const result = await setup.findByOwners(mocks.owners);

    expect(result).toEqual([mocks.transaction]);
    expect(spies.findMany).toHaveBeenCalledTimes(1);
    expect(spies.findMany).toHaveBeenCalledWith({
      include: mocks.include,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      where: { OR: [{ owner: 'USER', owner_id: mocks.owners[0].ownerId }] },
    });
  });
});

describe('Method update', () => {
  it('SHOULD update only the sent columns AND return the row with relations', async () => {
    spies.update.mockResolvedValue(mocks.transaction);

    const result = await setup.update({
      description: 'New',
      id: mocks.transaction.id,
      value: 100,
    });

    expect(result).toEqual(mocks.transaction);
    expect(spies.update).toHaveBeenCalledWith({
      data: {
        account_id: undefined,
        category_id: undefined,
        date: undefined,
        description: 'New',
        owner: undefined,
        owner_id: undefined,
        type: undefined,
        value: 100,
      },
      include: mocks.include,
      where: { id: mocks.transaction.id },
    });
  });
});
