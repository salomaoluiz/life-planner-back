import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceCategoryRepository = {
  // Adds `owner` to the scopes of every ALL category created by `creatorId` (idempotent).
  addScope(params: { creatorId: string; owner: OwnerAccess }): Promise<void>;
  createCategory(params: CreateCategoryRepositoryParams): Promise<CategoryEntity>;
  // The FK `ON DELETE CASCADE` removes the whole subtree in the same statement.
  deleteCategory(id: string): Promise<void>;
  // Spec 038 FR 12: copies the creator's ALL categories for the family, repoints the family's records, drops the scope.
  // Idempotent; returns how many categories were copied.
  detachFamilyScope(params: { creatorId: string; familyId: string }): Promise<number>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findCategories(params: FindCategoriesRepositoryParams): Promise<CategoryEntity[]>;
  findCategoryById(id: string): Promise<CategoryEntity | undefined>;
  removeScope(owner: OwnerAccess): Promise<void>;
  // Updates the category AND the depth of its subtree in ONE database transaction.
  updateCategory(params: UpdateCategoryRepositoryParams): Promise<CategoryEntity>;
};

interface CreateCategoryRepositoryParams {
  allScopes?: boolean;
  creatorId?: string;
  depthLevel: number;
  icon: string;
  iconColor: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  parentId?: string;
  scopes?: OwnerAccess[];
  type: TransactionType;
}
interface FindCategoriesRepositoryParams {
  owners: OwnerAccess[];
  type?: TransactionType;
}
interface SubtreeDepth {
  depthLevel: number;
  id: string;
}
interface UpdateCategoryRepositoryParams {
  depthLevel?: number;
  icon?: string;
  iconColor?: string;
  id: string;
  name?: string;
  // `null` makes the category a root; `undefined` leaves the parent untouched.
  parentId?: null | string;
  // Switch to ALL (the category and `subtreeIds`); `scopes` includes the creator's Personal scope.
  scope?: { creatorId: string; scopes: OwnerAccess[]; subtreeIds: string[] };
  subtreeDepths?: SubtreeDepth[];
  type?: TransactionType;
}

export {
  CreateCategoryRepositoryParams,
  FindCategoriesRepositoryParams,
  SubtreeDepth,
  UpdateCategoryRepositoryParams,
};
