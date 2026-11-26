import {
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  UpdateStockCategoryInput,
  UpdateStockCategorySchema,
} from '@stock/application/dto/StockCatalog';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import { assertIcon, buildCascade } from '@stock/application/service/CatalogAppearance';
import { assertFinanceMapping } from '@stock/application/service/FinanceMapping';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import {
  depthOf,
  descendantIds,
  MAX_CATEGORY_DEPTH,
  subtreeHeight,
} from '@stock/domain/service/CategoryTree';

// Spec 116 FR 21-24: rename, re-parent, map to finance, archive/reactivate (always with the subtree).
export class UpdateStockCategoryUseCase implements UseCaseWithParams<
  UpdateStockCategoryInput,
  StockCategoryEntity
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  private assertCanMove(
    categories: StockCategoryEntity[],
    category: StockCategoryEntity,
    parentId: string | undefined,
  ): void {
    if (parentId === undefined) {
      return;
    }

    const parent = categories.find((other) => other.id === parentId);

    if (!parent) {
      throw new UnprocessableEntityException('Parent category not found');
    }

    if (descendantIds(categories, category.id).includes(parentId)) {
      throw new UnprocessableEntityException('A category cannot go under itself');
    }

    if (parent.status === StockCatalogStatus.ARCHIVED) {
      throw new UnprocessableEntityException('Parent category is archived');
    }

    if (
      depthOf(categories, parent.id) + 1 + subtreeHeight(categories, category.id) >=
      MAX_CATEGORY_DEPTH
    ) {
      throw new UnprocessableEntityException(`Categories go up to ${MAX_CATEGORY_DEPTH} levels`);
    }
  }

  async execute(params: UpdateStockCategoryInput): Promise<StockCategoryEntity> {
    const input = validate(UpdateStockCategorySchema, params);
    const category = await this.catalogRepository.findCategoryById(input.id);

    if (
      !category ||
      !input.accessibleOwners.some(
        (owner) => owner.owner === category.owner && owner.ownerId === category.ownerId,
      )
    ) {
      throw new NotFoundException();
    }

    const target = { owner: category.owner, ownerId: category.ownerId };

    ensureCatalogWritable(input.accessibleOwners, target);
    assertFinanceMapping(input.financeCategoryId, input.financeCategories);
    assertIcon(input.icon, input.iconCatalog);

    const categories = await this.catalogRepository.findCategories(target);
    const parentId =
      input.parentId === undefined ? category.parentId : (input.parentId ?? undefined);
    const name = input.name ?? category.name;

    if (input.parentId !== undefined && parentId !== category.parentId) {
      this.assertCanMove(categories, category, parentId);
    }

    const duplicate = categories.some(
      (other) =>
        other.id !== category.id &&
        other.parentId === parentId &&
        other.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      throw new ConflictException('A category with this name already exists here');
    }

    if (
      input.status === StockCatalogStatus.ACTIVE &&
      category.status === StockCatalogStatus.ARCHIVED
    ) {
      const parent = categories.find((other) => other.id === parentId);

      if (parent?.status === StockCatalogStatus.ARCHIVED) {
        throw new UnprocessableEntityException('Reactivate the parent category first');
      }
    }

    const subtree = descendantIds(categories, category.id);
    const cascade = buildCascade(
      categories,
      subtree.filter((id) => id !== category.id),
      input,
    );
    const updated =
      input.name !== undefined ||
      input.parentId !== undefined ||
      input.financeCategoryId !== undefined ||
      input.color !== undefined ||
      input.icon !== undefined
        ? await this.catalogRepository.updateCategory({
            cascade,
            color: input.color,
            financeCategoryId: input.financeCategoryId,
            icon: input.icon,
            id: category.id,
            name: input.name,
            parentId: input.parentId,
          })
        : category;

    if (input.status !== undefined && input.status !== category.status) {
      await this.catalogRepository.setCategoryStatus(subtree, input.status);

      return { ...updated, status: input.status };
    }

    return updated;
  }
}
