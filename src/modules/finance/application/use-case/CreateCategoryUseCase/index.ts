import {
  BadRequestException,
  ForbiddenException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { CreateCategoryInput, CreateCategorySchema } from '@finance/application/dto/CreateCategory';
import { ALL_SCOPES } from '@finance/application/dto/FinanceCommon';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { belongsToOwner, isVisibleTo } from '@finance/domain/entity/CategoryScope';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { isSystemCategoryId } from '@finance/domain/entity/SystemCategory';
import { AccountStatus } from '@finance/domain/enum';
import { IFinanceCategoryRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';

export class CreateCategoryUseCase implements UseCaseWithParams<
  CreateCategoryInput,
  CategoryEntity
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: CreateCategoryInput): Promise<CategoryEntity> {
    const input = validate(CreateCategorySchema, params);
    const isAll = input.owner === ALL_SCOPES;
    const target = isAll
      ? { owner: OwnerType.USER, ownerId: input.callerId as string }
      : { owner: input.owner as OwnerType, ownerId: input.ownerId as string };

    if (!hasOwnerAccess(input.accessibleOwners, target)) {
      throw new ForbiddenException('Owner not accessible');
    }

    let depthLevel = 0;
    let parent: CategoryEntity | undefined;

    if (input.parentId !== undefined) {
      if (isSystemCategoryId(input.parentId)) {
        throw new UnprocessableEntityException('System categories cannot be changed');
      }

      parent = await this.categoryRepository.findCategoryById(input.parentId);

      if (!parent || !isVisibleTo(parent, input.accessibleOwners)) {
        throw new NotFoundException('Parent category not found');
      }

      if (parent.status === AccountStatus.ARCHIVED) {
        throw new UnprocessableEntityException('Parent category is archived');
      }

      // A child follows its parent's scopes: ALL under ALL, a single scope under the same single scope.
      if (isAll !== parent.allScopes || (!isAll && !belongsToOwner(parent, target))) {
        throw new BadRequestException('Parent category belongs to another owner');
      }

      if (parent.type !== input.type) {
        throw new BadRequestException('Parent category has a different type');
      }

      depthLevel = parent.depthLevel + 1;
    }

    const base = {
      depthLevel,
      icon: input.icon,
      iconColor: input.iconColor,
      name: input.name,
      parentId: input.parentId,
      type: input.type,
    };

    if (!isAll) {
      return this.categoryRepository.createCategory({ ...base, ...target });
    }

    return this.categoryRepository.createCategory({
      ...base,
      allScopes: true,
      creatorId: parent?.creatorId ?? target.ownerId,
      owner: parent?.owner ?? target.owner,
      ownerId: parent?.ownerId ?? target.ownerId,
      scopes: parent?.scopes ?? input.accessibleOwners,
    });
  }
}
