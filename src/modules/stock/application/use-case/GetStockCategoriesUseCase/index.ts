import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetStockCatalogInput, GetStockCatalogSchema } from '@stock/application/dto/StockCatalog';
import { ensureOwnerReadable } from '@stock/application/service/CatalogAccess';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { descendantIds, effectiveFinanceCategoryId } from '@stock/domain/service/CategoryTree';

export interface StockCategoryRow {
  category: StockCategoryEntity;
  effectiveFinanceCategoryId?: string;
  // Spec 125 section 7: the items of the category and of its whole subtree.
  itemCount: number;
}

// Flat rows (the API nests them): archived ones only on request. No owner = every owner the user can read.
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
    let targets: OwnerAccess[];

    if (input.owner !== undefined && input.ownerId !== undefined) {
      const target = { owner: input.owner, ownerId: input.ownerId };

      ensureOwnerReadable(input.accessibleOwners, target);
      targets = [target];
    } else {
      targets = input.accessibleOwners;
    }

    const rows = await Promise.all(
      targets.map(async (target) => this.rowsOf(target, input.includeArchived)),
    );

    return rows.flat();
  }

  private async rowsOf(target: OwnerAccess, includeArchived: boolean): Promise<StockCategoryRow[]> {
    const [categories, counts] = await Promise.all([
      this.catalogRepository.findCategories(target),
      this.catalogRepository.countItemsByCategory(target),
    ]);

    return categories
      .filter((category) => includeArchived || category.status === StockCatalogStatus.ACTIVE)
      .map((category) => ({
        category,
        effectiveFinanceCategoryId: effectiveFinanceCategoryId(categories, category.id),
        itemCount: descendantIds(categories, category.id).reduce(
          (sum, id) => sum + (counts.get(id) ?? 0),
          0,
        ),
      }));
  }
}
