import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { StartPurchaseInput, StartPurchaseSchema } from '@stock/application/dto/Purchase';
import { ensureListActive, loadWritableList } from '@stock/application/service/ShoppingListAccess';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import PurchaseEntity from '@stock/domain/entity/PurchaseEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import {
  IMarketRepository,
  IPurchaseRepository,
  IShoppingListRepository,
} from '@stock/domain/repository';

export interface StartPurchaseOutput {
  created: boolean;
  purchase: PurchaseEntity;
}

// Spec 120 FR 2-3: the id comes from the client (offline start); a repeat with the same id and user answers the
// stored purchase. The market must be an active one of the list's owner.
export class StartPurchaseUseCase implements UseCaseWithParams<
  StartPurchaseInput,
  StartPurchaseOutput
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IMarketRepository')
    private readonly marketRepository: IMarketRepository,
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(params: StartPurchaseInput): Promise<StartPurchaseOutput> {
    const input = validate(StartPurchaseSchema, params);
    const list = await loadWritableList(this.listRepository, input.accessibleOwners, input.listId);

    ensureListActive(list);

    const market = await this.marketRepository.findById(input.marketId);

    if (!market || !hasOwnerAccess(input.accessibleOwners, market)) {
      throw new NotFoundException();
    }

    if (
      market.owner !== list.owner ||
      market.ownerId !== list.ownerId ||
      market.status !== StockCatalogStatus.ACTIVE
    ) {
      throw new UnprocessableEntityException('Choose an active market of the list owner');
    }

    return this.purchaseRepository.create({
      currency: list.currency,
      id: input.id,
      listId: list.id,
      marketId: market.id,
      owner: list.owner,
      ownerId: list.ownerId,
      purchaseDate: input.purchaseDate,
      userId: input.userId,
    });
  }
}
