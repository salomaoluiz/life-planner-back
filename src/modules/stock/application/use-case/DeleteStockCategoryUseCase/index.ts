import { Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  DeleteStockCatalogInput,
  DeleteStockCatalogSchema,
} from '@stock/application/dto/StockCatalog';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import { planDelete } from '@stock/application/service/CatalogAppearance';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { descendantIds } from '@stock/domain/service/CategoryTree';

// FR 24 + spec 125 FR 20-23: free when no item (subtree included) uses it; else `moveTo` decides, or 409 `{ itemCount }`.
export class DeleteStockCategoryUseCase implements UseCaseWithParams<
  DeleteStockCatalogInput,
  void
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: DeleteStockCatalogInput): Promise<void> {
    const input = validate(DeleteStockCatalogSchema, params);
    const category = await this.catalogRepository.findCategoryById(input.id);

    if (!category || !hasOwnerAccess(input.accessibleOwners, category)) {
      throw new NotFoundException();
    }

    const target = { owner: category.owner, ownerId: category.ownerId };

    ensureCatalogWritable(input.accessibleOwners, target);

    const [categories, counts] = await Promise.all([
      this.catalogRepository.findCategories(target),
      this.catalogRepository.countItemsByCategory(target),
    ]);
    const subtree = descendantIds(categories, category.id);
    const itemCount = subtree.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
    const move = planDelete(categories, subtree, itemCount, {
      inUseMessage: 'Category is in use',
      moveTo: input.moveTo,
    });

    await this.catalogRepository.deleteCategory(category.id, move);
  }
}
