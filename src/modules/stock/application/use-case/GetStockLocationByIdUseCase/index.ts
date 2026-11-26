import { Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  GetStockLocationByIdInput,
  GetStockLocationByIdSchema,
} from '@stock/application/dto/StockCatalog';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { descendantIds, pathOf } from '@stock/domain/service/CategoryTree';

export interface StockLocationRow {
  // The location and its sub-locations (spec 125 FR 18).
  itemCount: number;
  location: StockLocationEntity;
  // "Kitchen / Fridge" (the same format as the category path).
  path: string;
}

// Spec 117 FR 30: the QR route header. Unreadable and deleted both answer 404, so nothing leaks.
export class GetStockLocationByIdUseCase implements UseCaseWithParams<
  GetStockLocationByIdInput,
  StockLocationRow
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: GetStockLocationByIdInput): Promise<StockLocationRow> {
    const input = validate(GetStockLocationByIdSchema, params);
    const location = await this.catalogRepository.findLocationById(input.id);

    if (!location || !hasOwnerAccess(input.accessibleOwners, location)) {
      throw new NotFoundException();
    }

    const [locations, counts] = await Promise.all([
      this.catalogRepository.findLocations(location),
      this.catalogRepository.countItemsByLocation(location),
    ]);

    return {
      itemCount: descendantIds(locations, location.id).reduce(
        (sum, id) => sum + (counts.get(id) ?? 0),
        0,
      ),
      location,
      path: pathOf(locations, location.id),
    };
  }
}
