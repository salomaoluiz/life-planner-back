import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  UpdateStockItemInput,
  UpdateStockItemSchema,
} from '@stock/application/dto/UpdateStockItem';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockEntity from '@stock/domain/entity/StockEntity';
import { IStockRepository } from '@stock/domain/repository';

export class UpdateStockItemUseCase implements UseCaseWithParams<
  UpdateStockItemInput,
  StockEntity
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: UpdateStockItemInput): Promise<StockEntity> {
    const input = validate(UpdateStockItemSchema, params);

    const item = await this.stockRepository.findById(input.id);

    // 404 first (never confirm another owner's ids), then 403 for the destination owner.
    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    if (
      input.owner !== undefined &&
      input.ownerId !== undefined &&
      !hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })
    ) {
      throw new ForbiddenException('Owner not accessible');
    }

    return this.stockRepository.update({
      barcode: input.barcode,
      brand: input.brand,
      description: input.description,
      expirationDate: input.expirationDate,
      id: input.id,
      notes: input.notes,
      openingDate: input.openingDate,
      owner: input.owner,
      ownerId: input.ownerId,
      purchaseDate: input.purchaseDate,
      quantity: input.quantity,
      unit: input.unit,
    });
  }
}
