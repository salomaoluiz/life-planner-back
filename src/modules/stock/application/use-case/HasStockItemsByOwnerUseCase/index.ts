import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  HasStockItemsByOwnerInput,
  HasStockItemsByOwnerSchema,
} from '@stock/application/dto/HasStockItemsByOwner';
import { IStockRepository } from '@stock/domain/repository';

// "Does this owner still have stock items?": used by the family delete guard (409).
export class HasStockItemsByOwnerUseCase implements UseCaseWithParams<
  HasStockItemsByOwnerInput,
  boolean
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: HasStockItemsByOwnerInput): Promise<boolean> {
    const input = validate(HasStockItemsByOwnerSchema, params);

    return this.stockRepository.existsByOwner(input);
  }
}
