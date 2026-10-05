import { BadRequestException, ConflictException, Inject, NotFoundException } from '@nestjs/common';

import { UpdateCategoryInput, UpdateCategorySchema } from '@finance/application/dto/UpdateCategory';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceCategoryRepository, SubtreeDepth } from '@finance/domain/repository';
import { collectDescendants } from '@finance/domain/service/CategoryTree';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class UpdateCategoryUseCase implements UseCaseWithParams<
  UpdateCategoryInput,
  CategoryEntity
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: UpdateCategoryInput): Promise<CategoryEntity> {
    const input = validate(UpdateCategorySchema, params);

    const category = await this.categoryRepository.findCategoryById(input.id);

    if (!category || !hasOwnerAccess(input.accessibleOwners, category)) {
      throw new NotFoundException();
    }

    const nextType = input.type ?? category.type;
    const nextParentId =
      input.parentId === undefined ? category.parentId : (input.parentId ?? undefined);
    const parentChanges = nextParentId !== category.parentId;
    const typeChanges = nextType !== category.type;

    const sameOwnerCategories = await this.categoryRepository.findCategories({
      owners: [{ owner: category.owner, ownerId: category.ownerId }],
    });
    const descendants = collectDescendants(sameOwnerCategories, category.id);

    // A type change is only safe on a childless category that stays (or becomes) a root:
    // otherwise the tree would mix EXPENSE and INCOME.
    if (
      typeChanges &&
      (descendants.length > 0 || (category.parentId !== undefined && !parentChanges))
    ) {
      throw new ConflictException('Category type cannot be changed');
    }

    let depthLevel: number | undefined;
    let subtreeDepths: SubtreeDepth[] | undefined;

    if (parentChanges) {
      let nextDepth = 0;

      if (nextParentId !== undefined) {
        const parent = await this.categoryRepository.findCategoryById(nextParentId);

        if (!parent || !hasOwnerAccess(input.accessibleOwners, parent)) {
          throw new NotFoundException('Parent category not found');
        }

        if (parent.owner !== category.owner || parent.ownerId !== category.ownerId) {
          throw new BadRequestException('Parent category belongs to another owner');
        }

        if (parent.type !== nextType) {
          throw new BadRequestException('Parent category has a different type');
        }

        if (parent.id === category.id || descendants.some((child) => child.id === parent.id)) {
          throw new BadRequestException(
            'A category cannot be moved under itself or its descendants',
          );
        }

        nextDepth = parent.depthLevel + 1;
      }

      depthLevel = nextDepth;

      const delta = nextDepth - category.depthLevel;

      if (delta !== 0 && descendants.length > 0) {
        subtreeDepths = descendants.map((child) => ({
          depthLevel: child.depthLevel + delta,
          id: child.id,
        }));
      }
    }

    return this.categoryRepository.updateCategory({
      depthLevel,
      icon: input.icon,
      iconColor: input.iconColor,
      id: input.id,
      name: input.name,
      parentId: parentChanges ? (nextParentId ?? null) : undefined,
      subtreeDepths,
      type: input.type,
    });
  }
}
