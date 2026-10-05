import { FinancialCategory, OwnerType, TransactionType } from '@db/client';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

export interface CreateCategoryDatasourceParams {
  depth_level: number;
  icon: string;
  icon_color: string;
  name: string;
  owner: OwnerType;
  owner_id: string;
  parent_id?: string;
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
  create(params: CreateCategoryDatasourceParams): Promise<FinancialCategory>;
  delete(id: string): Promise<void>;
  exists(params: ExistsCategoryDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<FinancialCategory | null>;
  findByOwners(params: FindCategoriesByOwnersDatasourceParams): Promise<FinancialCategory[]>;
  update(params: UpdateCategoryDatasourceParams): Promise<FinancialCategory>;
}
export interface UpdateCategoryDatasourceParams {
  depth_level?: number;
  icon?: string;
  icon_color?: string;
  id: string;
  name?: string;
  parent_id?: null | string;
  subtree_depths?: { depth_level: number; id: string }[];
  type?: TransactionType;
}
