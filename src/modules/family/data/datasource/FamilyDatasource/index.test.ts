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
