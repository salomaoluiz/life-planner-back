import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetStockCatalogInput, GetStockCatalogSchema } from '@stock/application/dto/StockCatalog';
import { ensureOwnerReadable } from '@stock/application/service/CatalogAccess';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';

export interface StockLocationRow {
  itemCount: number;
  location: StockLocationEntity;
}

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
    const target = { owner: input.owner, ownerId: input.ownerId };

    ensureOwnerReadable(input.accessibleOwners, target);

    const [locations, counts] = await Promise.all([
      this.catalogRepository.findLocations(target),
      this.catalogRepository.countItemsByLocation(target),
    ]);

    return locations
      .filter((location) => input.includeArchived || location.status === StockCatalogStatus.ACTIVE)
      .map((location) => ({ itemCount: counts.get(location.id) ?? 0, location }));
  }
}
