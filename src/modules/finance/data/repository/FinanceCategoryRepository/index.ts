import { Inject, Injectable } from '@nestjs/common';

import { FinanceCategoryMapper } from '@finance/data/datasource/mapper/FinanceCategoryMapper';
import { IFinanceCategoryDatasource } from '@finance/data/repository/datasource/IFinanceCategoryDatasource';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  CreateCategoryRepositoryParams,
  FindCategoriesRepositoryParams,
  IFinanceCategoryRepository,
  UpdateCategoryRepositoryParams,
} from '@finance/domain/repository';

function toScopeRow(access: OwnerAccess) {
  return { owner: access.owner, owner_id: access.ownerId };
}

@Injectable()
export class FinanceCategoryRepository implements IFinanceCategoryRepository {
  constructor(
    @Inject('IFinanceCategoryDatasource')
    private readonly categoryDatasource: IFinanceCategoryDatasource,
  ) {}

  async addScope(params: { creatorId: string; owner: OwnerAccess }): Promise<void> {
    await this.categoryDatasource.addScope({
      creator_id: params.creatorId,
      owner: params.owner.owner,
      owner_id: params.owner.ownerId,
    });
  }

  async createCategory(params: CreateCategoryRepositoryParams): Promise<CategoryEntity> {
    const result = await this.categoryDatasource.create({
      all_scopes: params.allScopes,
      creator_id: params.creatorId,
      depth_level: params.depthLevel,
      icon: params.icon,
      icon_color: params.iconColor,
      name: params.name,
      owner: params.owner,
      owner_id: params.ownerId,
      parent_id: params.parentId,
      scopes: params.scopes?.map(toScopeRow),
      type: params.type,
    });

    return FinanceCategoryMapper.toDomain(result);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.categoryDatasource.delete(id);
  }

  async detachFamilyScope(params: { creatorId: string; familyId: string }): Promise<number> {
    return this.categoryDatasource.detachFamilyScope({
      creator_id: params.creatorId,
      family_id: params.familyId,
    });
  }

  async existsByOwner(access: OwnerAccess): Promise<boolean> {
    return this.categoryDatasource.exists({ owner: access.owner, owner_id: access.ownerId });
  }

  async findCategories(params: FindCategoriesRepositoryParams): Promise<CategoryEntity[]> {
    const result = await this.categoryDatasource.findByOwners({
      owners: params.owners,
      type: params.type,
    });

    return result.map((row) => FinanceCategoryMapper.toDomain(row));
  }

  async findCategoryById(id: string): Promise<CategoryEntity | undefined> {
    const result = await this.categoryDatasource.findById(id);

    return result ? FinanceCategoryMapper.toDomain(result) : undefined;
  }

  async removeScope(owner: OwnerAccess): Promise<void> {
    await this.categoryDatasource.removeScope(toScopeRow(owner));
  }

  async updateCategory(params: UpdateCategoryRepositoryParams): Promise<CategoryEntity> {
    const result = await this.categoryDatasource.update({
      depth_level: params.depthLevel,
      icon: params.icon,
      icon_color: params.iconColor,
      id: params.id,
      name: params.name,
      parent_id: params.parentId,
      scope: params.scope && {
        creator_id: params.scope.creatorId,
        scopes: params.scope.scopes.map(toScopeRow),
        subtree_ids: params.scope.subtreeIds,
      },
      status: params.status,
      subtree_appearance: params.subtreeAppearance?.map((item) => ({
        icon: item.icon,
        icon_color: item.iconColor,
        id: item.id,
      })),
      subtree_depths: params.subtreeDepths?.map((subtree) => ({
        depth_level: subtree.depthLevel,
        id: subtree.id,
      })),
      subtree_ids: params.subtreeIds,
      type: params.type,
    });

    return FinanceCategoryMapper.toDomain(result);
  }
}
