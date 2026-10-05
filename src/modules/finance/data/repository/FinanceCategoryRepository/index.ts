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

@Injectable()
export class FinanceCategoryRepository implements IFinanceCategoryRepository {
  constructor(
    @Inject('IFinanceCategoryDatasource')
    private readonly categoryDatasource: IFinanceCategoryDatasource,
  ) {}

  async createCategory(params: CreateCategoryRepositoryParams): Promise<CategoryEntity> {
    const result = await this.categoryDatasource.create({
      depth_level: params.depthLevel,
      icon: params.icon,
      icon_color: params.iconColor,
      name: params.name,
      owner: params.owner,
      owner_id: params.ownerId,
      parent_id: params.parentId,
      type: params.type,
    });

    return FinanceCategoryMapper.toDomain(result);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.categoryDatasource.delete(id);
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

  async updateCategory(params: UpdateCategoryRepositoryParams): Promise<CategoryEntity> {
    const result = await this.categoryDatasource.update({
      depth_level: params.depthLevel,
      icon: params.icon,
      icon_color: params.iconColor,
      id: params.id,
      name: params.name,
      parent_id: params.parentId,
      subtree_depths: params.subtreeDepths?.map((subtree) => ({
        depth_level: subtree.depthLevel,
        id: subtree.id,
      })),
      type: params.type,
    });

    return FinanceCategoryMapper.toDomain(result);
  }
}
