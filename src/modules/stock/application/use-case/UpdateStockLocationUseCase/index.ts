import { ConflictException, Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  UpdateStockLocationInput,
  UpdateStockLocationSchema,
} from '@stock/application/dto/StockCatalog';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';

export class UpdateStockLocationUseCase implements UseCaseWithParams<
  UpdateStockLocationInput,
  StockLocationEntity
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: UpdateStockLocationInput): Promise<StockLocationEntity> {
    const input = validate(UpdateStockLocationSchema, params);
    const location = await this.catalogRepository.findLocationById(input.id);

    if (!location || !hasOwnerAccess(input.accessibleOwners, location)) {
      throw new NotFoundException();
    }

    const target = { owner: location.owner, ownerId: location.ownerId };

    ensureCatalogWritable(input.accessibleOwners, target);

    if (input.name !== undefined) {
      const name = input.name.toLowerCase();
      const taken = (await this.catalogRepository.findLocations(target)).some(
        (other) => other.id !== location.id && other.name.toLowerCase() === name,
      );

      if (taken) {
        throw new ConflictException('A location with this name already exists');
      }
    }

    return this.catalogRepository.updateLocation({
      id: location.id,
      name: input.name,
      status: input.status,
    });
  }
}
