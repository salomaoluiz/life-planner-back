import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TagEntity from '@finance/domain/entity/TagEntity';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceTagRepository = {
  // Adds `owner` to the scopes of every ALL tag created by `creatorId` (idempotent).
  addScope(params: { creatorId: string; owner: OwnerAccess }): Promise<void>;
  createTag(params: CreateTagRepositoryParams): Promise<TagEntity>;
  // The FK `ON DELETE CASCADE` removes the scopes and every link in the same statement.
  deleteTag(id: string): Promise<void>;
  // Spec 043 §4: copies the creator's ALL tags for the family, repoints the family's links, drops the scope.
  // Idempotent; returns how many tags were copied.
  detachFamilyScope(params: { creatorId: string; familyId: string }): Promise<number>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  // The scopes of the tags (other than `excludeId`) usable in `scopes` that already use `name` (ignoring case).
  findConflictingScopes(params: FindTagConflictsRepositoryParams): Promise<OwnerAccess[]>;
  findTagById(id: string): Promise<TagEntity | undefined>;
  // `usageCount` counts the transactions and recurrences of `owners` only.
  findTags(params: FindTagsRepositoryParams): Promise<TagEntity[]>;
  removeScope(owner: OwnerAccess): Promise<void>;
  updateTag(params: UpdateTagRepositoryParams): Promise<TagEntity>;
};

interface CreateTagRepositoryParams {
  allScopes?: boolean;
  creatorId: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  scopes?: OwnerAccess[];
}
interface FindTagConflictsRepositoryParams {
  excludeId?: string;
  name: string;
  scopes: OwnerAccess[];
}
interface FindTagsRepositoryParams {
  owners: OwnerAccess[];
  q?: string;
}
interface UpdateTagRepositoryParams {
  id: string;
  name?: string;
  // Switch to ALL; `scopes` includes the creator's Personal scope.
  scope?: { creatorId: string; scopes: OwnerAccess[] };
}

export {
  CreateTagRepositoryParams,
  FindTagConflictsRepositoryParams,
  FindTagsRepositoryParams,
  UpdateTagRepositoryParams,
};
