import { NotFoundException } from '@nestjs/common';

import { LogLevel } from '@shared/infra/logger/types';

import { mocks, setup } from './family-member.service.mocks';

describe('findAll', () => {
  it('SHOULD list with ISO dates, null for pending fields AND name/photo summaries for joined members', async () => {
    const result = await setup.findAll(mocks.userId, mocks.familyId);

    expect(mocks.getFamilyMembersUseCase.execute).toHaveBeenCalledWith({
      familyId: mocks.familyId,
      userId: mocks.userId,
    });
    expect(result).toEqual([
      expect.objectContaining({
        joinedAt: '2026-10-01T12:00:00.000Z',
        role: 'OWNER',
        user: { name: 'Test Owner', photoUrl: null },
        userId: mocks.userId,
      }),
      expect.objectContaining({
        user: { name: 'Member', photoUrl: 'https://example.com/m.png' },
      }),
      expect.objectContaining({
        joinedAt: null,
        status: 'PENDING',
        user: null,
        userId: null,
      }),
    ]);
  });

  it('SHOULD fetch the user summaries in ONE batched call for joined members only (no N+1)', async () => {
    await setup.findAll(mocks.userId, mocks.familyId);

    expect(mocks.findUsersByIdsUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mocks.findUsersByIdsUseCase.execute).toHaveBeenCalledWith({
      ids: [mocks.userId, mocks.otherUserId],
    });
  });

  it('SHOULD expose NOTHING beyond the contract fields (no email of other users, token, hash, createdAt)', async () => {
    const [first] = await setup.findAll(mocks.userId, mocks.familyId);

    expect(Object.keys(first).sort()).toEqual(
      [
        'email',
        'familyId',
        'id',
        'inviteExpired',
        'joinedAt',
        'role',
        'status',
        'user',
        'userId',
      ].sort(),
    );
    expect(Object.keys(first.user as object).sort()).toEqual(['name', 'photoUrl']);
  });

  it('SHOULD give user=null for a joined member whose user no longer exists', async () => {
    mocks.findUsersByIdsUseCase.execute.mockResolvedValueOnce([
      { email: 'owner@example.com', id: mocks.userId, name: 'Test Owner' },
    ]);

    const result = await setup.findAll(mocks.userId, mocks.familyId);

    expect(result[1].user).toBeNull();
    expect(result[1].status).toBe('JOINED');
  });

  it('SHOULD still succeed with user=null everywhere AND log a warning WHEN the user lookup throws', async () => {
    mocks.findUsersByIdsUseCase.execute.mockRejectedValueOnce(new Error('db down'));

    const result = await setup.findAll(mocks.userId, mocks.familyId);

    expect(result).toHaveLength(3);
    expect(result.every((member) => member.user === null)).toBe(true);
    expect(mocks.logger.log).toHaveBeenCalledWith(LogLevel.WARN, expect.any(String), {
      familyId: mocks.familyId,
      module: 'FamilyMemberService',
    });
  });

  it('SHOULD NOT call the user module WHEN there are no joined members', async () => {
    mocks.getFamilyMembersUseCase.execute.mockResolvedValueOnce([mocks.rows.pending]);

    await setup.findAll(mocks.userId, mocks.familyId);

    expect(mocks.findUsersByIdsUseCase.execute).not.toHaveBeenCalled();
  });

  it('SHOULD propagate NotFoundException for a non-member', async () => {
    mocks.getFamilyMembersUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.findAll(mocks.userId, mocks.familyId)).rejects.toThrow(NotFoundException);
  });
});

describe('invite', () => {
  it('SHOULD invite with the JWT user AND return the member, the raw token and the expiry once', async () => {
    mocks.inviteFamilyMemberUseCase.execute.mockResolvedValueOnce({
      inviteExpiresAt: new Date('2026-10-11T12:00:00Z'),
      inviteToken: 'raw-token',
      member: mocks.rows.pending,
    });

    const result = await setup.invite(mocks.userId, mocks.familyId, {
      email: 'invitee@example.com',
    });

    expect(mocks.inviteFamilyMemberUseCase.execute).toHaveBeenCalledWith({
      email: 'invitee@example.com',
      familyId: mocks.familyId,
      userId: mocks.userId,
    });
    expect(result).toEqual({
      inviteExpiresAt: '2026-10-11T12:00:00.000Z',
      inviteToken: 'raw-token',
      member: expect.objectContaining({
        role: 'MEMBER',
        status: 'PENDING',
        user: null,
        userId: null,
      }),
    });
  });

  it('SHOULD ignore a client-supplied userId in the body', async () => {
    mocks.inviteFamilyMemberUseCase.execute.mockResolvedValueOnce({
      inviteExpiresAt: new Date(),
      inviteToken: 't',
      member: mocks.rows.pending,
    });
    const spoofed = { email: 'a@example.com', userId: 'someone-else' } as { email: string };

    await setup.invite(mocks.userId, mocks.familyId, spoofed);

    expect(mocks.inviteFamilyMemberUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: mocks.userId }),
    );
  });
});

describe('delete', () => {
  it('SHOULD delete as the JWT user', async () => {
    await setup.delete(mocks.userId, 'member-id');

    expect(mocks.deleteFamilyMemberUseCase.execute).toHaveBeenCalledWith({
      memberId: 'member-id',
      userId: mocks.userId,
    });
  });
});

describe('preview', () => {
  it('SHOULD resolve the caller email from the user module AND return ISO expiry', async () => {
    mocks.getFamilyInvitePreviewUseCase.execute.mockResolvedValueOnce({
      email: 'invitee@example.com',
      emailMatches: false,
      familyId: mocks.familyId,
      familyName: 'Family Example',
      inviteExpiresAt: new Date('2026-10-11T12:00:00Z'),
    });

    const result = await setup.preview(mocks.userId, 'raw-token');

    expect(mocks.findUserByIdUseCase.execute).toHaveBeenCalledWith({ id: mocks.userId });
    expect(mocks.getFamilyInvitePreviewUseCase.execute).toHaveBeenCalledWith({
      token: 'raw-token',
      userEmail: 'caller@example.com',
    });
    expect(result).toEqual({
      email: 'invitee@example.com',
      emailMatches: false,
      familyId: mocks.familyId,
      familyName: 'Family Example',
      inviteExpiresAt: '2026-10-11T12:00:00.000Z',
    });
  });

  it('SHOULD throw NotFoundException AND skip the preview WHEN the JWT user no longer exists', async () => {
    mocks.findUserByIdUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.preview(mocks.userId, 'raw-token')).rejects.toThrow(NotFoundException);
    expect(mocks.getFamilyInvitePreviewUseCase.execute).not.toHaveBeenCalled();
  });
});

describe('accept', () => {
  it('SHOULD accept as the JWT user with their email AND return the joined member with the caller summary', async () => {
    mocks.acceptFamilyInviteUseCase.execute.mockResolvedValueOnce({
      ...mocks.rows.joined,
      userId: mocks.userId,
    });

    const result = await setup.accept(mocks.userId, 'raw-token');

    expect(mocks.acceptFamilyInviteUseCase.execute).toHaveBeenCalledWith({
      token: 'raw-token',
      userEmail: 'caller@example.com',
      userId: mocks.userId,
    });
    expect(result).toMatchObject({
      status: 'JOINED',
      user: { name: 'Caller', photoUrl: 'https://example.com/c.png' },
      userId: mocks.userId,
    });
    expect(mocks.findUsersByIdsUseCase.execute).not.toHaveBeenCalled();
  });

  it('SHOULD NOT accept anything WHEN the JWT user no longer exists', async () => {
    mocks.findUserByIdUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.accept(mocks.userId, 'raw-token')).rejects.toThrow(NotFoundException);
    expect(mocks.acceptFamilyInviteUseCase.execute).not.toHaveBeenCalled();
  });
});
