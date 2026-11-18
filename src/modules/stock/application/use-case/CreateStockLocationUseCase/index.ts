import { ConflictException, Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  CreateStockLocationInput,
  CreateStockLocationSchema,
} from '@stock/application/dto/StockCatalog';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';

export class CreateStockLocationUseCase implements UseCaseWithParams<
  CreateStockLocationInput,
  StockLocationEntity
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: CreateStockLocationInput): Promise<StockLocationEntity> {
    const input = validate(CreateStockLocationSchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    ensureCatalogWritable(input.accessibleOwners, target);

    const locations = await this.catalogRepository.findLocations(target);

    if (locations.some((location) => location.name.toLowerCase() === input.name.toLowerCase())) {
      throw new ConflictException('A location with this name already exists');
    }

    return this.catalogRepository.createLocation({
      name: input.name,
      owner: input.owner,
      ownerId: input.ownerId,
    });
  }
}
