import { FamilyMember } from '@db/client';

export interface CreateMemberDatasourceParams {
  email: string;
  family_id: string;
  invite_expires_at: Date;
  invite_token: string;
}
export interface FindMemberByEmailDatasourceParams {
  email: string;
  familyId: string;
}
export interface FindMembershipDatasourceParams {
  familyId: string;
  userId: string;
}
export interface IFamilyMemberDatasource {
  // null = unique violation on (family_id, email).
  create(params: CreateMemberDatasourceParams): Promise<FamilyMember | null>;
  delete(id: string): Promise<void>;
  findByEmail(params: FindMemberByEmailDatasourceParams): Promise<FamilyMember | null>;
  findByFamilyId(familyId: string): Promise<FamilyMember[]>;
  findById(id: string): Promise<FamilyMember | null>;
  findByTokenHash(tokenHash: string): Promise<FamilyMember | null>;
  findMembership(params: FindMembershipDatasourceParams): Promise<FamilyMember | null>;
  // null = the row was no longer pending (single conditional UPDATE).
  join(params: JoinMemberDatasourceParams): Promise<FamilyMember | null>;
}
export interface JoinMemberDatasourceParams {
  id: string;
  joined_at: Date;
  user_id: string;
}
