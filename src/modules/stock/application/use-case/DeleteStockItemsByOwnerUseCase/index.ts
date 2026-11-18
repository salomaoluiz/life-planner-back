import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  DeleteStockItemsByOwnerInput,
  DeleteStockItemsByOwnerSchema,
} from '@stock/application/dto/DeleteStockItemsByOwner';
import { IStockCatalogRepository, IStockRepository } from '@stock/domain/repository';

// Account deletion: purges every stock item (lots and movements cascade), category and location of one owner (a
// user or a family). Idempotent; returns the items deleted.
export class DeleteStockItemsByOwnerUseCase implements UseCaseWithParams<
  DeleteStockItemsByOwnerInput,
  number
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: DeleteStockItemsByOwnerInput): Promise<number> {
    const input = validate(DeleteStockItemsByOwnerSchema, params);
    const deleted = await this.stockRepository.deleteByOwner(input);

    await this.catalogRepository.deleteByOwner(input);

    return deleted;
  }
}
