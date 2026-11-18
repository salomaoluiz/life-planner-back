import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetStockCatalogInput, GetStockCatalogSchema } from '@stock/application/dto/StockCatalog';
import { ensureOwnerReadable } from '@stock/application/service/CatalogAccess';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { effectiveFinanceCategoryId } from '@stock/domain/service/CategoryTree';

export interface StockCategoryRow {
  category: StockCategoryEntity;
  effectiveFinanceCategoryId?: string;
  itemCount: number;
}

// Flat rows (the API nests them): archived ones only on request.
export class GetStockCategoriesUseCase implements UseCaseWithParams<
  GetStockCatalogInput,
  StockCategoryRow[]
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: GetStockCatalogInput): Promise<StockCategoryRow[]> {
    const input = validate(GetStockCatalogSchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    ensureOwnerReadable(input.accessibleOwners, target);

    const [categories, counts] = await Promise.all([
      this.catalogRepository.findCategories(target),
      this.catalogRepository.countItemsByCategory(target),
    ]);

    return categories
      .filter((category) => input.includeArchived || category.status === StockCatalogStatus.ACTIVE)
      .map((category) => ({
        category,
        effectiveFinanceCategoryId: effectiveFinanceCategoryId(categories, category.id),
        itemCount: counts.get(category.id) ?? 0,
      }));
  }
}
