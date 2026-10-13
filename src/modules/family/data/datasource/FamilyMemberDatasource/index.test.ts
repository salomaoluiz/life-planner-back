import { mocks, setup, spies } from './index.mocks';

describe('Method create', () => {
  const params = {
    email: 'test@example.com',
    family_id: 'family-id',
    invite_expires_at: new Date('2026-10-11T12:00:00Z'),
    invite_token: 'token-hash',
  };

  it('SHOULD insert ONLY the pending-invite columns AND return the row', async () => {
    spies.create.mockResolvedValue(mocks.member);

    const result = await setup.create(params);

    expect(result).toEqual(mocks.member);
    expect(spies.create).toHaveBeenCalledWith({ data: params });
  });

  it('SHOULD return null WHEN Postgres reports a unique violation (P2002)', async () => {
    spies.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    expect(await setup.create(params)).toBeNull();
  });

  it('SHOULD rethrow any other error', async () => {
    spies.create.mockRejectedValue(Object.assign(new Error('down'), { code: 'P1001' }));

    await expect(setup.create(params)).rejects.toThrow('down');
  });

  it('SHOULD rethrow a non-object rejection', async () => {
    spies.create.mockRejectedValue('boom');

    await expect(setup.create(params)).rejects.toBe('boom');
  });
});

describe('Method delete', () => {
  it('SHOULD delete by id without failing WHEN the row is already gone', async () => {
    spies.deleteMany.mockResolvedValue({ count: 0 });

    await expect(setup.delete(mocks.member.id)).resolves.toBeUndefined();
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.member.id } });
  });
});

describe('Method findByEmail', () => {
  it('SHOULD look the row up by the (family, email) unique key', async () => {
    spies.findUnique.mockResolvedValue(mocks.member);

    const result = await setup.findByEmail({ email: 'test@example.com', familyId: 'family-id' });

    expect(result).toEqual(mocks.member);
    expect(spies.findUnique).toHaveBeenCalledWith({
      where: { family_id_email: { email: 'test@example.com', family_id: 'family-id' } },
    });
  });
});

describe('Method findByFamilyId', () => {
  it('SHOULD return every row of the family (pending and joined)', async () => {
    spies.findMany.mockResolvedValue([mocks.member]);

    expect(await setup.findByFamilyId('family-id')).toEqual([mocks.member]);
    expect(spies.findMany).toHaveBeenCalledWith({ where: { family_id: 'family-id' } });
  });
});

describe('Method findById', () => {
  it('SHOULD return the row WHEN found AND null WHEN not', async () => {
    spies.findUnique.mockResolvedValueOnce(mocks.member).mockResolvedValueOnce(null);

    expect(await setup.findById(mocks.member.id)).toEqual(mocks.member);
    expect(await setup.findById('missing')).toBeNull();
    expect(spies.findUnique).toHaveBeenCalledWith({ where: { id: mocks.member.id } });
  });
});

describe('Method findByTokenHash', () => {
  it('SHOULD look the row up by the unique invite_token (the hash)', async () => {
    spies.findUnique.mockResolvedValue(mocks.member);

    expect(await setup.findByTokenHash('token-hash')).toEqual(mocks.member);
    expect(spies.findUnique).toHaveBeenCalledWith({ where: { invite_token: 'token-hash' } });
  });
});

describe('Method findMembership', () => {
  it('SHOULD match ONLY a JOINED row of that user in that family', async () => {
    spies.findFirst.mockResolvedValue(mocks.member);

    await setup.findMembership({ familyId: 'family-id', userId: mocks.userId });

    expect(spies.findFirst).toHaveBeenCalledWith({
      where: { family_id: 'family-id', joined_at: { not: null }, user_id: mocks.userId },
    });
  });

  it('SHOULD return null WHEN there is none', async () => {
    spies.findFirst.mockResolvedValue(null);

    expect(await setup.findMembership({ familyId: 'f', userId: 'u' })).toBeNull();
  });
});

describe('Method join', () => {
  const params = {
    id: 'member-id',
    joined_at: new Date('2026-10-05T10:00:00Z'),
    user_id: 'user-id',
  };

  it('SHOULD run ONE conditional update (user_id IS NULL) that also clears the token', async () => {
    spies.updateMany.mockResolvedValue({ count: 1 });
    spies.findUnique.mockResolvedValue({ ...mocks.member, user_id: 'user-id' });

    const result = await setup.join(params);

    expect(spies.updateMany).toHaveBeenCalledTimes(1);
    expect(spies.updateMany).toHaveBeenCalledWith({
      data: {
        invite_expires_at: null,
        invite_token: null,
        joined_at: params.joined_at,
        user_id: 'user-id',
      },
      where: { id: 'member-id', user_id: null },
    });
    expect(spies.findUnique).toHaveBeenCalledWith({ where: { id: 'member-id' } });
    expect(result).toEqual({ ...mocks.member, user_id: 'user-id' });
  });

  it('SHOULD return null AND NOT read the row WHEN nothing matched (already used / lost the race)', async () => {
    spies.updateMany.mockResolvedValue({ count: 0 });

    expect(await setup.join(params)).toBeNull();
    expect(spies.findUnique).not.toHaveBeenCalled();
  });
});
