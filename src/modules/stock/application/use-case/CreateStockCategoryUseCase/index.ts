import { ConflictException, Inject, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  CreateStockCategoryInput,
  CreateStockCategorySchema,
} from '@stock/application/dto/StockCatalog';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import { assertFinanceMapping } from '@stock/application/service/FinanceMapping';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { depthOf, MAX_CATEGORY_DEPTH } from '@stock/domain/service/CategoryTree';

export class CreateStockCategoryUseCase implements UseCaseWithParams<
  CreateStockCategoryInput,
  StockCategoryEntity
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: CreateStockCategoryInput): Promise<StockCategoryEntity> {
    const input = validate(CreateStockCategorySchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    ensureCatalogWritable(input.accessibleOwners, target);
    assertFinanceMapping(input.financeCategoryId, input.financeCategories);

    const categories = await this.catalogRepository.findCategories(target);

    if (input.parentId !== undefined) {
      const parent = categories.find((category) => category.id === input.parentId);

      if (!parent) {
        throw new UnprocessableEntityException('Parent category not found');
      }

      if (parent.status === StockCatalogStatus.ARCHIVED) {
        throw new UnprocessableEntityException('Parent category is archived');
      }

      if (depthOf(categories, parent.id) + 1 >= MAX_CATEGORY_DEPTH) {
        throw new UnprocessableEntityException(`Categories go up to ${MAX_CATEGORY_DEPTH} levels`);
      }
    }

    const sibling = categories.some(
      (category) =>
        category.parentId === input.parentId &&
        category.name.toLowerCase() === input.name.toLowerCase(),
    );

    if (sibling) {
      throw new ConflictException('A category with this name already exists here');
    }

    return this.catalogRepository.createCategory({
      financeCategoryId: input.financeCategoryId,
      name: input.name,
      owner: input.owner,
      ownerId: input.ownerId,
      parentId: input.parentId,
    });
  }
}
