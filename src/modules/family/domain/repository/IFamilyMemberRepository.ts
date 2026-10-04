import FamilyMemberEntity from '@family/domain/entity/FamilyMemberEntity';

export type IFamilyMemberRepository = {
  // Resolves undefined when (family, email) already exists (unique violation), even under a race.
  createInvite(params: CreateInviteRepositoryParams): Promise<FamilyMemberEntity | undefined>;
  deleteById(id: string): Promise<void>;
  findByEmail(params: FindMemberByEmailRepositoryParams): Promise<FamilyMemberEntity | undefined>;
  findByFamilyId(familyId: string): Promise<FamilyMemberEntity[]>;
  findById(id: string): Promise<FamilyMemberEntity | undefined>;
  findByTokenHash(tokenHash: string): Promise<FamilyMemberEntity | undefined>;
  // JOINED rows only.
  findMembership(params: FindMembershipRepositoryParams): Promise<FamilyMemberEntity | undefined>;
  // Resolves undefined when the row is no longer pending (already used / lost a race).
  join(params: JoinRepositoryParams): Promise<FamilyMemberEntity | undefined>;
};

interface CreateInviteRepositoryParams {
  email: string;
  familyId: string;
  inviteExpiresAt: Date;
  tokenHash: string;
}
interface FindMemberByEmailRepositoryParams {
  email: string;
  familyId: string;
}
interface FindMembershipRepositoryParams {
  familyId: string;
  userId: string;
}
interface JoinRepositoryParams {
  id: string;
  joinedAt: Date;
  userId: string;
}

export {
  CreateInviteRepositoryParams,
  FindMemberByEmailRepositoryParams,
  FindMembershipRepositoryParams,
  JoinRepositoryParams,
};
