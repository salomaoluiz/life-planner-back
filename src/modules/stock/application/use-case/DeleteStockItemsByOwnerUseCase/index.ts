import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  DeleteStockItemsByOwnerInput,
  DeleteStockItemsByOwnerSchema,
} from '@stock/application/dto/DeleteStockItemsByOwner';
import { IStockRepository } from '@stock/domain/repository';

// Account deletion: purges every stock item of one owner (a user or a family). Idempotent; returns rows deleted.
export class DeleteStockItemsByOwnerUseCase implements UseCaseWithParams<
  DeleteStockItemsByOwnerInput,
  number
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: DeleteStockItemsByOwnerInput): Promise<number> {
    const input = validate(DeleteStockItemsByOwnerSchema, params);

    return this.stockRepository.deleteByOwner(input);
  }
}
