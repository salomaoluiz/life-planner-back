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

// FR 26 + spec 125 FR 20-23: free when no item (sub-locations included) uses it; else `moveTo` decides, or 409.
export class DeleteStockLocationUseCase implements UseCaseWithParams<
  DeleteStockCatalogInput,
  void
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: DeleteStockCatalogInput): Promise<void> {
    const input = validate(DeleteStockCatalogSchema, params);
    const location = await this.catalogRepository.findLocationById(input.id);

    if (!location || !hasOwnerAccess(input.accessibleOwners, location)) {
      throw new NotFoundException();
    }

    const target = { owner: location.owner, ownerId: location.ownerId };

    ensureCatalogWritable(input.accessibleOwners, target);

    const [locations, counts] = await Promise.all([
      this.catalogRepository.findLocations(target),
      this.catalogRepository.countItemsByLocation(target),
    ]);
    const subtree = descendantIds(locations, location.id);
    const itemCount = subtree.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
    const move = planDelete(locations, subtree, itemCount, {
      inUseMessage: 'Location is in use',
      moveTo: input.moveTo,
    });

    await this.catalogRepository.deleteLocation(location.id, move);
  }
}
