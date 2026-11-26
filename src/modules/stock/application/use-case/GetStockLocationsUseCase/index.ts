import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetStockCatalogInput, GetStockCatalogSchema } from '@stock/application/dto/StockCatalog';
import { ensureOwnerReadable } from '@stock/application/service/CatalogAccess';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { descendantIds } from '@stock/domain/service/CategoryTree';

export interface StockLocationRow {
  // Spec 125 section 7: the items of the location and of its sub-locations.
  itemCount: number;
  location: StockLocationEntity;
}

// Flat rows (the API nests them): archived ones only on request. No owner = every owner the user can read.
export class GetStockLocationsUseCase implements UseCaseWithParams<
  GetStockCatalogInput,
  StockLocationRow[]
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: GetStockCatalogInput): Promise<StockLocationRow[]> {
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

  private async rowsOf(target: OwnerAccess, includeArchived: boolean): Promise<StockLocationRow[]> {
    const [locations, counts] = await Promise.all([
      this.catalogRepository.findLocations(target),
      this.catalogRepository.countItemsByLocation(target),
    ]);

    return locations
      .filter((location) => includeArchived || location.status === StockCatalogStatus.ACTIVE)
      .map((location) => ({
        itemCount: descendantIds(locations, location.id).reduce(
          (sum, id) => sum + (counts.get(id) ?? 0),
          0,
        ),
        location,
      }));
  }
}
