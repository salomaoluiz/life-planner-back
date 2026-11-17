import { ConflictException, Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  DeleteStockCatalogInput,
  DeleteStockCatalogSchema,
} from '@stock/application/dto/StockCatalog';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { IStockCatalogRepository } from '@stock/domain/repository';

// FR 26: only when no item uses it, else 409 with `{ itemCount }`.
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

    ensureCatalogWritable(input.accessibleOwners, location);

    const itemCount =
      (await this.catalogRepository.countItemsByLocation(location)).get(location.id) ?? 0;

    if (itemCount > 0) {
      throw new ConflictException({ itemCount, message: 'Location is in use', statusCode: 409 });
    }

    await this.catalogRepository.deleteLocation(location.id);
  }
}
