import { mocks, setup, spies } from './index.mocks';

describe('Method create', () => {
  it('SHOULD insert the account AND return the row', async () => {
    spies.create.mockResolvedValue(mocks.account);
    const params = {
      balance: 152075,
      icon: 'bank',
      name: 'Checking',
      owner: 'USER' as const,
      owner_id: mocks.account.owner_id,
      status: 'ACTIVE' as const,
    };

    const result = await setup.create(params);

    expect(result).toEqual(mocks.account);
    expect(spies.create).toHaveBeenCalledWith({ data: params });
  });
});

describe('Method delete', () => {
  it('SHOULD delete by id without failing WHEN the row is already gone', async () => {
    spies.deleteMany.mockResolvedValue({ count: 0 });

    await expect(setup.delete(mocks.account.id)).resolves.toBeUndefined();
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.account.id } });
  });
});

describe('Method exists', () => {
  const params = { owner: 'FAMILY' as const, owner_id: 'family-id' };

  it('SHOULD return true WHEN the owner has at least one account (cheap select of the id only)', async () => {
    spies.findFirst.mockResolvedValue({ id: mocks.account.id });

    expect(await setup.exists(params)).toBe(true);
    expect(spies.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { owner: 'FAMILY', owner_id: 'family-id' },
    });
  });

  it('SHOULD return false WHEN the owner has none', async () => {
    spies.findFirst.mockResolvedValue(null);

    expect(await setup.exists(params)).toBe(false);
  });
});

describe('Method findById', () => {
  it('SHOULD return the row, or null WHEN not found', async () => {
    spies.findUnique.mockResolvedValueOnce(mocks.account).mockResolvedValueOnce(null);

    expect(await setup.findById(mocks.account.id)).toEqual(mocks.account);
    expect(await setup.findById('missing')).toBeNull();
    expect(spies.findUnique).toHaveBeenCalledWith({ where: { id: mocks.account.id } });
  });
});

describe('Method findByOwners', () => {
  it('SHOULD query every (owner, owner_id) pair in ONE findMany', async () => {
    spies.findMany.mockResolvedValue([mocks.account]);

    const result = await setup.findByOwners(mocks.owners);

    expect(result).toEqual([mocks.account]);
    expect(spies.findMany).toHaveBeenCalledTimes(1);
    expect(spies.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { owner: 'USER', owner_id: mocks.owners[0].ownerId },
          { owner: 'FAMILY', owner_id: mocks.owners[1].ownerId },
        ],
      },
    });
  });
});

describe('Method update', () => {
  it('SHOULD update ONLY the editable columns (never owner / owner_id)', async () => {
    spies.update.mockResolvedValue(mocks.account);

    const result = await setup.update({ balance: 100, id: mocks.account.id, name: 'Renamed' });

    expect(result).toEqual(mocks.account);
    expect(spies.update).toHaveBeenCalledWith({
      data: { balance: 100, icon: undefined, name: 'Renamed', status: undefined },
      where: { id: mocks.account.id },
    });
  });
});
