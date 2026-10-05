import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetStockItemsInput, GetStockItemsSchema } from '@stock/application/dto/GetStockItems';
import { narrowOwners } from '@stock/domain/entity/OwnerAccess';
import StockEntity from '@stock/domain/entity/StockEntity';
import { IStockRepository } from '@stock/domain/repository';

// expirationDate ascending (nulls last), then description case-insensitive, then id.
export class GetStockItemsUseCase implements UseCaseWithParams<GetStockItemsInput, StockEntity[]> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: GetStockItemsInput): Promise<StockEntity[]> {
    const input = validate(GetStockItemsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerId);

    if (owners.length === 0) {
      return [];
    }

    const items = await this.stockRepository.findByOwners(owners);

    return [...items].sort(compareStockItems);
  }
}

function compareExpiration(a: StockEntity, b: StockEntity): number {
  if (a.expirationDate && b.expirationDate) {
    return a.expirationDate.getTime() - b.expirationDate.getTime();
  }
  if (a.expirationDate) {
    return -1;
  }

  return b.expirationDate ? 1 : 0;
}
function compareStockItems(a: StockEntity, b: StockEntity): number {
  return (
    compareExpiration(a, b) ||
    a.description.toLowerCase().localeCompare(b.description.toLowerCase()) ||
    a.id.localeCompare(b.id)
  );
}
