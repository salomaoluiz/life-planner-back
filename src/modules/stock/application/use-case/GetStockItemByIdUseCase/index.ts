import { Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  GetStockItemByIdInput,
  GetStockItemByIdSchema,
} from '@stock/application/dto/GetStockItemById';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockEntity from '@stock/domain/entity/StockEntity';
import { IStockRepository } from '@stock/domain/repository';

export class GetStockItemByIdUseCase implements UseCaseWithParams<
  GetStockItemByIdInput,
  StockEntity
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: GetStockItemByIdInput): Promise<StockEntity> {
    const input = validate(GetStockItemByIdSchema, params);

    const item = await this.stockRepository.findById(input.id);

    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    return item;
  }
}
