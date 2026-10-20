import { mocks, setup, spies } from './index.mocks';

describe('Method create', () => {
  it('SHOULD create the family AND the joined owner membership in ONE nested write', async () => {
    spies.create.mockResolvedValue(mocks.family);

    const result = await setup.create({
      email: 'test@example.com',
      name: mocks.family.name,
      owner_id: mocks.userId,
    });

    expect(result).toEqual(mocks.family);
    expect(spies.create).toHaveBeenCalledTimes(1);
    expect(spies.create).toHaveBeenCalledWith({
      data: {
        members: {
          create: { email: 'test@example.com', joined_at: expect.any(Date), user_id: mocks.userId },
        },
        name: mocks.family.name,
        owner_id: mocks.userId,
      },
    });
  });

  it('SHOULD propagate the error WHEN the nested write fails (nothing is persisted by Prisma)', async () => {
    spies.create.mockRejectedValue(new Error('unique violation'));

    await expect(
      setup.create({ email: 'test@example.com', name: 'x', owner_id: mocks.userId }),
    ).rejects.toThrow('unique violation');
  });
});

describe('Method delete', () => {
  it('SHOULD delete by id without failing WHEN the row is already gone', async () => {
    spies.deleteMany.mockResolvedValue({ count: 0 });

    await expect(setup.delete(mocks.family.id)).resolves.toBeUndefined();
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.family.id } });
  });
});

describe('Method findById', () => {
  it('SHOULD return the family WHEN found', async () => {
    spies.findUnique.mockResolvedValue(mocks.family);

    expect(await setup.findById(mocks.family.id)).toEqual(mocks.family);
    expect(spies.findUnique).toHaveBeenCalledWith({ where: { id: mocks.family.id } });
  });

  it('SHOULD return null WHEN NOT found', async () => {
    spies.findUnique.mockResolvedValue(null);

    expect(await setup.findById(mocks.family.id)).toBeNull();
  });
});

describe('Method findByUserId', () => {
  it('SHOULD query ONLY families with a JOINED membership of the user', async () => {
    spies.findMany.mockResolvedValue([mocks.family]);

    const result = await setup.findByUserId(mocks.userId);

    expect(result).toEqual([mocks.family]);
    expect(spies.findMany).toHaveBeenCalledTimes(1);
    expect(spies.findMany).toHaveBeenCalledWith({
      where: { members: { some: { joined_at: { not: null }, user_id: mocks.userId } } },
    });
  });
});

describe('Method isMember', () => {
  it('SHOULD return true WHEN a joined membership exists', async () => {
    spies.memberCount.mockResolvedValue(1);

    const result = await setup.isMember({ familyId: mocks.family.id, userId: mocks.userId });

    expect(result).toBe(true);
    expect(spies.memberCount).toHaveBeenCalledWith({
      where: { family_id: mocks.family.id, joined_at: { not: null }, user_id: mocks.userId },
    });
  });

  it('SHOULD return false WHEN there is no joined membership (pending invite or stranger)', async () => {
    spies.memberCount.mockResolvedValue(0);

    expect(await setup.isMember({ familyId: mocks.family.id, userId: mocks.userId })).toBe(false);
  });
});

describe('Method update', () => {
  it('SHOULD update ONLY the name AND return the family', async () => {
    spies.update.mockResolvedValue(mocks.family);

    const result = await setup.update({ id: mocks.family.id, name: 'Renamed' });

    expect(result).toEqual(mocks.family);
    expect(spies.update).toHaveBeenCalledWith({
      data: { name: 'Renamed' },
      where: { id: mocks.family.id },
    });
  });
});

describe('Method update (status)', () => {
  it('SHOULD update the status ONLY WHEN a status is given', async () => {
    spies.update.mockResolvedValue(mocks.family);

    await setup.update({ id: mocks.family.id, status: 'ARCHIVED' });

    expect(spies.update).toHaveBeenCalledWith({
      data: { status: 'ARCHIVED' },
      where: { id: mocks.family.id },
    });
  });
});

describe('Method findIdsByOwnerId', () => {
  it('SHOULD select only ids of families whose owner_id is the user (not mere memberships)', async () => {
    spies.findMany.mockResolvedValueOnce([{ id: 'family-1' }, { id: 'family-2' }]);

    expect(await setup.findIdsByOwnerId('user-id')).toEqual(['family-1', 'family-2']);
    expect(spies.findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: { owner_id: 'user-id' },
    });
  });
});

describe('Method deleteUserData', () => {
  it('SHOULD delete owned families, the user memberships AND pending invites to the email in ONE transaction', async () => {
    spies.transaction.mockResolvedValueOnce([{ count: 2 }, { count: 3 }]);
    spies.deleteMany.mockReturnValueOnce('families-op');
    spies.memberDeleteMany.mockReturnValueOnce('members-op');

    const result = await setup.deleteUserData({ email: 'test@example.com', userId: 'user-id' });

    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { owner_id: 'user-id' } });
    expect(spies.memberDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { user_id: 'user-id' },
          { email: { equals: 'test@example.com', mode: 'insensitive' }, user_id: null },
        ],
      },
    });
    expect(spies.transaction).toHaveBeenCalledWith(['families-op', 'members-op']);
    expect(result).toEqual({ families: 2, memberships: 3 });
  });

  it('SHOULD be idempotent WHEN nothing is left (counts 0, no error)', async () => {
    spies.transaction.mockResolvedValueOnce([{ count: 0 }, { count: 0 }]);

    expect(await setup.deleteUserData({ email: 'test@example.com', userId: 'user-id' })).toEqual({
      families: 0,
      memberships: 0,
    });
  });
});
