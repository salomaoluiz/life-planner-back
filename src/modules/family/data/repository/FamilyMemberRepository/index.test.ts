import { mocks, setup, spies } from './index.mocks';

describe('createInvite', () => {
  const params = {
    email: 'test@example.com',
    familyId: 'family-id',
    inviteExpiresAt: new Date('2026-10-11T12:00:00Z'),
    tokenHash: 'token-hash',
  };

  it('SHOULD map the params to snake_case columns (hash into invite_token) AND return the entity', async () => {
    const result = await setup.createInvite(params);

    expect(spies.datasource.create).toHaveBeenCalledWith({
      email: 'test@example.com',
      family_id: 'family-id',
      invite_expires_at: params.inviteExpiresAt,
      invite_token: 'token-hash',
    });
    expect(spies.mapper.toDomain).toHaveBeenCalledWith(mocks.persistence);
    expect(result).toEqual(mocks.member);
  });

  it('SHOULD return undefined WHEN the datasource reports a unique violation', async () => {
    spies.datasource.create.mockResolvedValueOnce(null);

    expect(await setup.createInvite(params)).toBeUndefined();
    expect(spies.mapper.toDomain).not.toHaveBeenCalled();
  });
});

describe('deleteById', () => {
  it('SHOULD delegate to the datasource', async () => {
    await setup.deleteById('member-id');

    expect(spies.datasource.delete).toHaveBeenCalledWith('member-id');
  });
});

describe('findByEmail', () => {
  it('SHOULD return the mapped entity WHEN found AND undefined WHEN not', async () => {
    spies.datasource.findByEmail
      .mockResolvedValueOnce(mocks.persistence)
      .mockResolvedValueOnce(null);

    expect(await setup.findByEmail({ email: 'a@example.com', familyId: 'f' })).toEqual(
      mocks.member,
    );
    expect(await setup.findByEmail({ email: 'b@example.com', familyId: 'f' })).toBeUndefined();
    expect(spies.datasource.findByEmail).toHaveBeenCalledWith({
      email: 'a@example.com',
      familyId: 'f',
    });
  });
});

describe('findByFamilyId', () => {
  it('SHOULD return the mapped members', async () => {
    expect(await setup.findByFamilyId('family-id')).toEqual([mocks.member]);
    expect(spies.datasource.findByFamilyId).toHaveBeenCalledWith('family-id');
  });

  it('SHOULD return [] WHEN the family has no rows', async () => {
    spies.datasource.findByFamilyId.mockResolvedValueOnce([]);

    expect(await setup.findByFamilyId('family-id')).toEqual([]);
  });
});

describe('findById', () => {
  it('SHOULD return the entity WHEN found AND undefined WHEN not', async () => {
    spies.datasource.findById.mockResolvedValueOnce(mocks.persistence).mockResolvedValueOnce(null);

    expect(await setup.findById('id')).toEqual(mocks.member);
    expect(await setup.findById('missing')).toBeUndefined();
  });
});

describe('findByTokenHash', () => {
  it('SHOULD query by the hash AND map the result', async () => {
    expect(await setup.findByTokenHash('token-hash')).toEqual(mocks.member);
    expect(spies.datasource.findByTokenHash).toHaveBeenCalledWith('token-hash');
  });

  it('SHOULD return undefined WHEN unknown', async () => {
    spies.datasource.findByTokenHash.mockResolvedValueOnce(null);

    expect(await setup.findByTokenHash('nope')).toBeUndefined();
  });
});

describe('findMembership', () => {
  it('SHOULD return the joined row WHEN there is one AND undefined WHEN not', async () => {
    spies.datasource.findMembership
      .mockResolvedValueOnce(mocks.persistence)
      .mockResolvedValueOnce(null);

    expect(await setup.findMembership({ familyId: 'f', userId: 'u' })).toEqual(mocks.member);
    expect(await setup.findMembership({ familyId: 'f', userId: 'u2' })).toBeUndefined();
  });
});

describe('join', () => {
  const params = {
    id: 'member-id',
    joinedAt: new Date('2026-10-05T10:00:00Z'),
    userId: 'user-id',
  };

  it('SHOULD map to columns AND return the joined entity', async () => {
    const result = await setup.join(params);

    expect(spies.datasource.join).toHaveBeenCalledWith({
      id: 'member-id',
      joined_at: params.joinedAt,
      user_id: 'user-id',
    });
    expect(result).toEqual(mocks.member);
  });

  it('SHOULD return undefined WHEN the row was no longer pending', async () => {
    spies.datasource.join.mockResolvedValueOnce(null);

    expect(await setup.join(params)).toBeUndefined();
  });
});
