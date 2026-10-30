import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ALL_SCOPES } from '@finance/application/dto/FinanceCommon';
import { UpdateCategoryInput, UpdateCategorySchema } from '@finance/application/dto/UpdateCategory';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { GetCategoryArchiveBlockersUseCase } from '@finance/application/use-case/GetCategoryArchiveBlockersUseCase';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { isVisibleTo, sameScopes } from '@finance/domain/entity/CategoryScope';
import { hasOwnerAccess, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { isSystemCategoryId } from '@finance/domain/entity/SystemCategory';
import { AccountStatus } from '@finance/domain/enum';
import {
  IFinanceCategoryRepository,
  IFinanceTransactionRepository,
  SubtreeDepth,
  UpdateCategoryRepositoryParams,
} from '@finance/domain/repository';
import { collectDescendants } from '@finance/domain/service/CategoryTree';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';

export class UpdateCategoryUseCase implements UseCaseWithParams<
  UpdateCategoryInput,
  CategoryEntity
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
    private readonly blockersUseCase: GetCategoryArchiveBlockersUseCase,
  ) {}

  async execute(params: UpdateCategoryInput): Promise<CategoryEntity> {
    const input = validate(UpdateCategorySchema, params);

    if (isSystemCategoryId(input.id) || (input.parentId && isSystemCategoryId(input.parentId))) {
      throw new UnprocessableEntityException(
        input.status !== undefined
          ? 'System categories cannot be archived'
          : 'System categories cannot be changed',
      );
    }

    const category = await this.categoryRepository.findCategoryById(input.id);

    if (!category || !isVisibleTo(category, input.accessibleOwners)) {
      throw new NotFoundException();
    }

    // An All category's owner is its creator's Personal scope, so only single-family categories are blocked.
    ensureOwnerWritable(input.accessibleOwners, category);

    const nextType = input.type ?? category.type;
    const nextParentId =
      input.parentId === undefined ? category.parentId : (input.parentId ?? undefined);
    const parentChanges = nextParentId !== category.parentId;
    const typeChanges = nextType !== category.type;

    const scopeCategories = await this.categoryRepository.findCategories({
      owners: category.scopes,
    });
    const descendants = collectDescendants(scopeCategories, category.id);

    this.assertSubtreeAppearance(input.subtreeAppearance, descendants);

    // Spec 041: archive / reactivate the category together with its whole subtree (no-op when unchanged).
    const status = input.status !== category.status ? input.status : undefined;

    if (status === AccountStatus.ACTIVE && category.parentId !== undefined) {
      const parent = await this.categoryRepository.findCategoryById(category.parentId);

      if (parent?.status === AccountStatus.ARCHIVED) {
        throw new UnprocessableEntityException('Parent category is archived');
      }
    }

    if (status === AccountStatus.ARCHIVED) {
      await this.assertNoPendingItems(category, descendants, input);
    }

    // Spec 038 FR 3: a single-scope root becomes ALL (with its subtree); there is no way back.
    const switchesToAll = input.scope === ALL_SCOPES && !category.allScopes;
    let scope: UpdateCategoryRepositoryParams['scope'];

    if (switchesToAll) {
      const caller = { owner: OwnerType.USER, ownerId: input.callerId as string };

      if (!input.callerId || !hasOwnerAccess(input.accessibleOwners, caller)) {
        throw new ForbiddenException('Owner not accessible');
      }

      if (category.parentId !== undefined || (parentChanges && nextParentId !== undefined)) {
        throw new BadRequestException('Only a main category can be turned into an All category');
      }

      scope = {
        creatorId: input.callerId,
        scopes: input.accessibleOwners,
        subtreeIds: descendants.map((child) => child.id),
      };
    }

    // A type change is only safe on a childless category that stays (or becomes) a root:
    // otherwise the tree would mix EXPENSE and INCOME.
    if (
      typeChanges &&
      (descendants.length > 0 || (category.parentId !== undefined && !parentChanges))
    ) {
      throw new ConflictException('Category type cannot be changed');
    }

    if (typeChanges && (await this.transactionRepository.countByCategoryIds([category.id])) > 0) {
      throw new ConflictException('Category type cannot be changed');
    }

    let depthLevel: number | undefined;
    let subtreeDepths: SubtreeDepth[] | undefined;

    if (parentChanges) {
      let nextDepth = 0;

      if (nextParentId !== undefined) {
        const parent = await this.categoryRepository.findCategoryById(nextParentId);

        if (!parent || !isVisibleTo(parent, input.accessibleOwners)) {
          throw new NotFoundException('Parent category not found');
        }

        if (parent.status === AccountStatus.ARCHIVED) {
          throw new UnprocessableEntityException('Parent category is archived');
        }

        // Same scopes as the category: ALL under ALL (same creator scopes), a single scope under the same scope.
        if (parent.allScopes !== category.allScopes || !sameScopes(parent, category)) {
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
      scope,
      status,
      subtreeAppearance: input.subtreeAppearance,
      subtreeDepths,
      subtreeIds: status && descendants.map((child) => child.id),
      type: input.type,
    });
  }

  // Spec 058 FR 4 / 9: every descendant id belongs to the subtree of the edited category, once.
  private assertSubtreeAppearance(
    items: { id: string }[] | undefined,
    descendants: CategoryEntity[],
  ): void {
    const allowed = new Set(descendants.map((child) => child.id));
    const seen = new Set<string>();

    for (const item of items ?? []) {
      if (seen.has(item.id)) {
        throw new UnprocessableEntityException('Duplicate descendant');
      }
      seen.add(item.id);

      if (!allowed.has(item.id)) {
        throw new UnprocessableEntityException('Descendant is not in the subtree');
      }
    }
  }

  // Spec 041 FR 7-8: recurrences and running installment plans of the subtree block the archive.
  private async assertNoPendingItems(
    category: CategoryEntity,
    descendants: CategoryEntity[],
    input: { accessibleOwners: OwnerAccess[]; today?: string },
  ): Promise<void> {
    const blockers = await this.blockersUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      categoryIds: [category.id, ...descendants.map((child) => child.id)],
      scopes: category.scopes,
      today: input.today ?? new Date().toISOString().slice(0, 10),
    });

    if (blockers.recurrences.length === 0 && blockers.installmentPlans.length === 0) {
      // Only hidden items: they still block, the caller just cannot see them.
      if (blockers.hiddenCount === 0) {
        return;
      }
    }

    throw new ConflictException({
      blockers: {
        installmentPlans: blockers.installmentPlans,
        recurrences: blockers.recurrences,
      },
      ...(blockers.hiddenCount > 0 && { hiddenCount: blockers.hiddenCount }),
      message: 'Category has pending items',
      statusCode: 409,
    });
  }
}
