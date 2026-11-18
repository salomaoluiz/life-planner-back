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

export interface StockLocationRow {
  itemCount: number;
  location: StockLocationEntity;
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

    const counts = await this.catalogRepository.countItemsByLocation(location);

    return { itemCount: counts.get(location.id) ?? 0, location };
  }
}
