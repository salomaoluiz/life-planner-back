import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceCategoryRepository = {
  createCategory(params: CreateCategoryRepositoryParams): Promise<CategoryEntity>;
  // The FK `ON DELETE CASCADE` removes the whole subtree in the same statement.
  deleteCategory(id: string): Promise<void>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findCategories(params: FindCategoriesRepositoryParams): Promise<CategoryEntity[]>;
  findCategoryById(id: string): Promise<CategoryEntity | undefined>;
  // Updates the category AND the depth of its subtree in ONE database transaction.
  updateCategory(params: UpdateCategoryRepositoryParams): Promise<CategoryEntity>;
};

interface CreateCategoryRepositoryParams {
  depthLevel: number;
  icon: string;
  iconColor: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  parentId?: string;
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
  subtreeDepths?: SubtreeDepth[];
  type?: TransactionType;
}

export {
  CreateCategoryRepositoryParams,
  FindCategoriesRepositoryParams,
  SubtreeDepth,
  UpdateCategoryRepositoryParams,
};
