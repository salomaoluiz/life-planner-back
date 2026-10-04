import FamilyMemberEntity from '@family/domain/entity/FamilyMemberEntity';

import { mocks, setup } from './index.mocks';

describe('toDomain', () => {
  it('SHOULD map a pending row AND turn null columns into undefined', () => {
    const result = setup.toDomain(mocks.pending);

    expect(result).toBeInstanceOf(FamilyMemberEntity);
    expect(result).toEqual({
      createdAt: mocks.pending.created_at,
      email: 'test@example.com',
      familyId: 'family-id',
      id: 'member-id',
      inviteExpiresAt: mocks.pending.invite_expires_at,
      joinedAt: undefined,
      userId: undefined,
    });
  });

  it('SHOULD map a joined row', () => {
    const result = setup.toDomain(mocks.joined);

    expect(result.userId).toBe('user-id');
    expect(result.joinedAt).toEqual(mocks.joined.joined_at);
    expect(result.inviteExpiresAt).toBeUndefined();
  });

  it('SHOULD NEVER expose the token hash on the entity', () => {
    expect(JSON.stringify(setup.toDomain(mocks.pending))).not.toContain('token-hash');
    expect(setup.toDomain(mocks.pending)).not.toHaveProperty('inviteToken');
    expect(setup.toDomain(mocks.pending)).not.toHaveProperty('invite_token');
  });
});
