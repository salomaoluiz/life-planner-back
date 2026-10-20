import { AccountStatus, OwnerType, TransactionType } from '@db/client';
import { FinancialCategoryWithScopes } from '@finance/data/datasource/mapper/FinanceCategoryMapper';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

export interface CategoryScopeDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface CreateCategoryDatasourceParams {
  all_scopes?: boolean;
  creator_id?: string;
  depth_level: number;
  icon: string;
  icon_color: string;
  name: string;
  owner: OwnerType;
  owner_id: string;
  parent_id?: string;
  scopes?: CategoryScopeDatasourceParams[];
  type: TransactionType;
}
export interface ExistsCategoryDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface FindCategoriesByOwnersDatasourceParams {
  owners: OwnerAccess[];
  type?: TransactionType;
}
export interface IFinanceCategoryDatasource {
  // Gives every ALL category of `creator_id` one more scope row (idempotent).
  addScope(params: { creator_id: string } & CategoryScopeDatasourceParams): Promise<void>;
  create(params: CreateCategoryDatasourceParams): Promise<FinancialCategoryWithScopes>;
  delete(id: string): Promise<void>;
  // Spec 038 FR 12: the family gets its own copy of the creator's ALL categories, repoints its records, drops the scope.
  detachFamilyScope(params: { creator_id: string; family_id: string }): Promise<number>;
  exists(params: ExistsCategoryDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<FinancialCategoryWithScopes | null>;
  findByOwners(
    params: FindCategoriesByOwnersDatasourceParams,
  ): Promise<FinancialCategoryWithScopes[]>;
  removeScope(params: CategoryScopeDatasourceParams): Promise<void>;
  update(params: UpdateCategoryDatasourceParams): Promise<FinancialCategoryWithScopes>;
}
export interface UpdateCategoryDatasourceParams {
  depth_level?: number;
  icon?: string;
  icon_color?: string;
  id: string;
  name?: string;
  parent_id?: null | string;
  // Switch to ALL: the category AND `subtree_ids` get the flag, the creator, their Personal scope as owner and `scopes`.
  scope?: { creator_id: string; scopes: CategoryScopeDatasourceParams[]; subtree_ids: string[] };
  status?: AccountStatus;
  subtree_depths?: { depth_level: number; id: string }[];
  // With `status`: these categories change status together with `id`.
  subtree_ids?: string[];
  type?: TransactionType;
}
