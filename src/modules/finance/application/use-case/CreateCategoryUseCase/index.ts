import { BadRequestException, ForbiddenException, Inject, NotFoundException } from '@nestjs/common';

import { CreateCategoryInput, CreateCategorySchema } from '@finance/application/dto/CreateCategory';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceCategoryRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
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

    if (!hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    let depthLevel = 0;

    if (input.parentId !== undefined) {
      const parent = await this.categoryRepository.findCategoryById(input.parentId);

      if (!parent || !hasOwnerAccess(input.accessibleOwners, parent)) {
        throw new NotFoundException('Parent category not found');
      }

      if (parent.owner !== input.owner || parent.ownerId !== input.ownerId) {
        throw new BadRequestException('Parent category belongs to another owner');
      }

      if (parent.type !== input.type) {
        throw new BadRequestException('Parent category has a different type');
      }

      depthLevel = parent.depthLevel + 1;
    }

    return this.categoryRepository.createCategory({
      depthLevel,
      icon: input.icon,
      iconColor: input.iconColor,
      name: input.name,
      owner: input.owner,
      ownerId: input.ownerId,
      parentId: input.parentId,
      type: input.type,
    });
  }
}
