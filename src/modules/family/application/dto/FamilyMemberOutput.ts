import FamilyMemberEntity from '@family/domain/entity/FamilyMemberEntity';
import { FamilyMemberRole, FamilyMemberStatus } from '@family/domain/enum';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type FamilyMemberUseCaseOutput = {
  createdAt: Date;
  email: string;
  familyId: string;
  id: string;
  inviteExpired: boolean;
  // Optional properties
  inviteExpiresAt?: Date;
  joinedAt?: Date;
  role: FamilyMemberRole;
  status: FamilyMemberStatus;
  userId?: string;
};

// Fail closed: a row without an expiry date can never be redeemed.
export function isInviteExpired(member: FamilyMemberEntity, now: Date = new Date()): boolean {
  return !member.inviteExpiresAt || member.inviteExpiresAt.getTime() <= now.getTime();
}
export function toFamilyMemberUseCaseOutput(
  member: FamilyMemberEntity,
  ownerId: string,
  now: Date = new Date(),
): FamilyMemberUseCaseOutput {
  const status = member.userId ? FamilyMemberStatus.JOINED : FamilyMemberStatus.PENDING;

  return {
    createdAt: member.createdAt,
    email: member.email,
    familyId: member.familyId,
    id: member.id,
    inviteExpired: status === FamilyMemberStatus.PENDING && isInviteExpired(member, now),
    inviteExpiresAt: member.inviteExpiresAt,
    joinedAt: member.joinedAt,
    role: member.userId === ownerId ? FamilyMemberRole.OWNER : FamilyMemberRole.MEMBER,
    status,
    userId: member.userId,
  };
}
