import { ForbiddenException, Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  CreateStockItemInput,
  CreateStockItemSchema,
} from '@stock/application/dto/CreateStockItem';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockEntity from '@stock/domain/entity/StockEntity';
import { IStockRepository } from '@stock/domain/repository';

export class CreateStockItemUseCase implements UseCaseWithParams<
  CreateStockItemInput,
  StockEntity
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: CreateStockItemInput): Promise<StockEntity> {
    const input = validate(CreateStockItemSchema, params);

    if (!hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    return this.stockRepository.create({
      barcode: input.barcode,
      brand: input.brand,
      description: input.description,
      expirationDate: input.expirationDate,
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
