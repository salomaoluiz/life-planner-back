import FamilyEntity from '@family/domain/entity/FamilyEntity';
import { FamilyStatus } from '@family/domain/enum';

export type IFamilyRepository = {
  createFamily(params: CreateFamilyRepositoryParams): Promise<FamilyEntity>;
  deleteFamily(id: string): Promise<void>;
  getFamilies(userId: string): Promise<FamilyEntity[]>;
  getFamilyById(familyId: string): Promise<FamilyEntity | undefined>;
  // Ids of the families the user OWNS (not the ones they merely joined).
  getOwnedFamilyIds(ownerId: string): Promise<string[]>;
  isFamilyMember(params: IsFamilyMemberRepositoryParams): Promise<boolean>;
  // Deletes the families the user owns, their other memberships and pending invites to their email. Idempotent.
  removeUser(params: RemoveUserRepositoryParams): Promise<RemoveUserRepositoryResult>;
  updateFamily(params: UpdateFamilyRepositoryParams): Promise<FamilyEntity>;
};

interface CreateFamilyRepositoryParams {
  name: string;
  ownerEmail: string;
  ownerId: string;
}
interface IsFamilyMemberRepositoryParams {
  familyId: string;
  userId: string;
}
interface RemoveUserRepositoryParams {
  email: string;
  userId: string;
}
interface RemoveUserRepositoryResult {
  families: number;
  memberships: number;
}
interface UpdateFamilyRepositoryParams {
  id: string;
  name?: string;
  status?: FamilyStatus;
}

export {
  CreateFamilyRepositoryParams,
  IsFamilyMemberRepositoryParams,
  RemoveUserRepositoryParams,
  RemoveUserRepositoryResult,
  UpdateFamilyRepositoryParams,
};
