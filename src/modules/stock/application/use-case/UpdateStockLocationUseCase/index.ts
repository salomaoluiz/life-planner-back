import {
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  UpdateStockLocationInput,
  UpdateStockLocationSchema,
} from '@stock/application/dto/StockCatalog';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import { assertIcon, buildCascade } from '@stock/application/service/CatalogAppearance';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import {
  depthOf,
  descendantIds,
  MAX_LOCATION_DEPTH,
  subtreeHeight,
} from '@stock/domain/service/CategoryTree';

// Spec 125 FR 14-15: rename, re-parent (one level of children), appearance, archive/reactivate with the subtree.
export class UpdateStockLocationUseCase implements UseCaseWithParams<
  UpdateStockLocationInput,
  StockLocationEntity
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  private assertCanMove(
    locations: StockLocationEntity[],
    location: StockLocationEntity,
    parentId: string | undefined,
  ): void {
    if (parentId === undefined) {
      return;
    }

    const parent = locations.find((other) => other.id === parentId);

    if (!parent) {
      throw new UnprocessableEntityException('Parent location not found');
    }

    if (descendantIds(locations, location.id).includes(parentId)) {
      throw new UnprocessableEntityException('A location cannot go under itself');
    }

    if (parent.status === StockCatalogStatus.ARCHIVED) {
      throw new UnprocessableEntityException('Parent location is archived');
    }

    if (
      depthOf(locations, parent.id) + 1 + subtreeHeight(locations, location.id) >=
      MAX_LOCATION_DEPTH
    ) {
      throw new UnprocessableEntityException(`Locations go up to ${MAX_LOCATION_DEPTH} levels`);
    }
  }

  async execute(params: UpdateStockLocationInput): Promise<StockLocationEntity> {
    const input = validate(UpdateStockLocationSchema, params);
    const location = await this.catalogRepository.findLocationById(input.id);

    if (!location || !hasOwnerAccess(input.accessibleOwners, location)) {
      throw new NotFoundException();
    }

    const target = { owner: location.owner, ownerId: location.ownerId };

    ensureCatalogWritable(input.accessibleOwners, target);
    assertIcon(input.icon, input.iconCatalog);

    const locations = await this.catalogRepository.findLocations(target);
    const parentId =
      input.parentId === undefined ? location.parentId : (input.parentId ?? undefined);
    const name = input.name ?? location.name;

    if (input.parentId !== undefined && parentId !== location.parentId) {
      this.assertCanMove(locations, location, parentId);
    }

    const duplicate = locations.some(
      (other) =>
        other.id !== location.id &&
        other.parentId === parentId &&
        other.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      throw new ConflictException('A location with this name already exists here');
    }

    if (
      input.status === StockCatalogStatus.ACTIVE &&
      location.status === StockCatalogStatus.ARCHIVED &&
      locations.find((other) => other.id === parentId)?.status === StockCatalogStatus.ARCHIVED
    ) {
      throw new UnprocessableEntityException('Reactivate the parent location first');
    }

    const subtree = descendantIds(locations, location.id);
    const cascade = buildCascade(
      locations,
      subtree.filter((id) => id !== location.id),
      input,
    );
    const updated =
      input.name !== undefined ||
      input.parentId !== undefined ||
      input.color !== undefined ||
      input.icon !== undefined
        ? await this.catalogRepository.updateLocation({
            cascade,
            color: input.color,
            icon: input.icon,
            id: location.id,
            name: input.name,
            parentId: input.parentId,
          })
        : location;

    if (input.status !== undefined && input.status !== location.status) {
      await this.catalogRepository.setLocationStatus(subtree, input.status);

      return { ...updated, status: input.status };
    }

    return updated;
  }
}
