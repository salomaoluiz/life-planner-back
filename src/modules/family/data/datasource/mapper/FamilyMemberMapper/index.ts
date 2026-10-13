import { FamilyMember } from '@db/client';
import FamilyMemberEntity from '@family/domain/entity/FamilyMemberEntity';

export class FamilyMemberMapper {
  // The token hash (`invite_token`) is deliberately not mapped: it never leaves the data layer.
  static toDomain(raw: FamilyMember): FamilyMemberEntity {
    return new FamilyMemberEntity({
      createdAt: raw.created_at,
      email: raw.email,
      familyId: raw.family_id,
      id: raw.id,
      // Optional properties
      inviteExpiresAt: raw.invite_expires_at ?? undefined,
      joinedAt: raw.joined_at ?? undefined,
      userId: raw.user_id ?? undefined,
    });
  }
}
