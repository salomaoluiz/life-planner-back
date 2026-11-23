import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  DeleteStockItemsByOwnerInput,
  DeleteStockItemsByOwnerSchema,
} from '@stock/application/dto/DeleteStockItemsByOwner';
import {
  IMarketRepository,
  IPurchaseRepository,
  IShoppingListRepository,
  IStockCatalogRepository,
  IStockRepository,
} from '@stock/domain/repository';

// Account deletion: purges every stock item (lots and movements cascade), category, location and shopping list of
// one owner (a user or a family). Idempotent; returns the items deleted.
export class DeleteStockItemsByOwnerUseCase implements UseCaseWithParams<
  DeleteStockItemsByOwnerInput,
  number
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IMarketRepository')
    private readonly marketRepository: IMarketRepository,
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(params: DeleteStockItemsByOwnerInput): Promise<number> {
    const input = validate(DeleteStockItemsByOwnerSchema, params);
    // Spec 120: purchases (with their events and price history) first, they point to lists and markets.
    await this.purchaseRepository.deleteByOwner(input);

    const deleted = await this.stockRepository.deleteByOwner(input);

    await this.catalogRepository.deleteByOwner(input);
    // Spec 118: the lists go after the items (rows cascade, dismissals went with the items).
    await this.listRepository.deleteByOwner(input);
    await this.marketRepository.deleteByOwner(input);

    return deleted;
  }
}
