import FamilyMemberEntityFixture from '@family/domain/entity/mocks/FamilyMemberEntity.fixture';
import { FamilyMemberRole, FamilyMemberStatus } from '@family/domain/enum';

import { isInviteExpired, toFamilyMemberUseCaseOutput } from './FamilyMemberOutput';

const now = new Date('2026-10-05T12:00:00Z');
const ownerId = 'owner-user-id';

describe('toFamilyMemberUseCaseOutput', () => {
  it('SHOULD derive OWNER/JOINED WHEN the row user is the family owner', () => {
    const member = new FamilyMemberEntityFixture().withUserId(ownerId).withJoinedAt(now).build();

    const result = toFamilyMemberUseCaseOutput(member, ownerId, now);

    expect(result).toMatchObject({
      inviteExpired: false,
      role: FamilyMemberRole.OWNER,
      status: FamilyMemberStatus.JOINED,
    });
  });

  it('SHOULD derive MEMBER/JOINED for another joined user', () => {
    const member = new FamilyMemberEntityFixture().withUserId('someone').withJoinedAt(now).build();

    expect(toFamilyMemberUseCaseOutput(member, ownerId, now)).toMatchObject({
      role: FamilyMemberRole.MEMBER,
      status: FamilyMemberStatus.JOINED,
    });
  });

  it('SHOULD derive MEMBER/PENDING AND inviteExpired=false WHEN the invite is still valid', () => {
    const member = new FamilyMemberEntityFixture()
      .withInviteExpiresAt(new Date('2026-10-06T12:00:00Z'))
      .build();

    expect(toFamilyMemberUseCaseOutput(member, ownerId, now)).toMatchObject({
      inviteExpired: false,
      role: FamilyMemberRole.MEMBER,
      status: FamilyMemberStatus.PENDING,
    });
  });

  it('SHOULD set inviteExpired=true for a pending row whose invite expired', () => {
    const member = new FamilyMemberEntityFixture()
      .withInviteExpiresAt(new Date('2026-10-04T12:00:00Z'))
      .build();

    expect(toFamilyMemberUseCaseOutput(member, ownerId, now).inviteExpired).toBe(true);
  });

  it('SHOULD NEVER flag a joined row as expired', () => {
    const member = new FamilyMemberEntityFixture().withUserId('u').withJoinedAt(now).build();

    expect(toFamilyMemberUseCaseOutput(member, ownerId, now).inviteExpired).toBe(false);
  });

  it('SHOULD NOT carry any token field', () => {
    const member = new FamilyMemberEntityFixture().build();

    expect(Object.keys(toFamilyMemberUseCaseOutput(member, ownerId, now)).join()).not.toMatch(
      /token/i,
    );
  });
});

describe('isInviteExpired', () => {
  it('SHOULD be true exactly AT the expiry instant', () => {
    const member = new FamilyMemberEntityFixture().withInviteExpiresAt(now).build();

    expect(isInviteExpired(member, now)).toBe(true);
  });

  it('SHOULD be false one millisecond before the expiry', () => {
    const member = new FamilyMemberEntityFixture()
      .withInviteExpiresAt(new Date(now.getTime() + 1))
      .build();

    expect(isInviteExpired(member, now)).toBe(false);
  });

  it('SHOULD fail closed (expired) WHEN there is no expiry date', () => {
    expect(isInviteExpired(new FamilyMemberEntityFixture().build(), now)).toBe(true);
  });
});
