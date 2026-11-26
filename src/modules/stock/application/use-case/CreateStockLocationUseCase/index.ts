import { ConflictException, Inject, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  CreateStockLocationInput,
  CreateStockLocationSchema,
} from '@stock/application/dto/StockCatalog';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import { assertIcon } from '@stock/application/service/CatalogAppearance';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { depthOf, MAX_LOCATION_DEPTH } from '@stock/domain/service/CategoryTree';

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
    assertIcon(input.icon, input.iconCatalog);

    const locations = await this.catalogRepository.findLocations(target);

    if (input.parentId !== undefined) {
      const parent = locations.find((location) => location.id === input.parentId);

      if (!parent) {
        throw new UnprocessableEntityException('Parent location not found');
      }

      if (parent.status === StockCatalogStatus.ARCHIVED) {
        throw new UnprocessableEntityException('Parent location is archived');
      }

      if (depthOf(locations, parent.id) + 1 >= MAX_LOCATION_DEPTH) {
        throw new UnprocessableEntityException(`Locations go up to ${MAX_LOCATION_DEPTH} levels`);
      }
    }

    const sibling = locations.some(
      (location) =>
        location.parentId === input.parentId &&
        location.name.toLowerCase() === input.name.toLowerCase(),
    );

    if (sibling) {
      throw new ConflictException('A location with this name already exists here');
    }

    return this.catalogRepository.createLocation({
      color: input.color,
      icon: input.icon,
      name: input.name,
      owner: input.owner,
      ownerId: input.ownerId,
      parentId: input.parentId,
    });
  }
}
