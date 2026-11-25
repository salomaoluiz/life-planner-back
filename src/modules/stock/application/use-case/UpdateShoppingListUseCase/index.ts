import { ConflictException, Inject, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  UpdateShoppingListInput,
  UpdateShoppingListSchema,
} from '@stock/application/dto/ShoppingList';
import { loadWritableList } from '@stock/application/service/ShoppingListAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { IMarketRepository, IShoppingListRepository } from '@stock/domain/repository';

// Spec 118 FR 3 and 4: default switch, archive and reactivate (the AUTO rows move inside the datasource
// transaction).
export class UpdateShoppingListUseCase implements UseCaseWithParams<
  UpdateShoppingListInput,
  ShoppingListEntity
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IMarketRepository')
    private readonly marketRepository: IMarketRepository,
  ) {}

  async execute(params: UpdateShoppingListInput): Promise<ShoppingListEntity> {
    const input = validate(UpdateShoppingListSchema, params);
    const list = await loadWritableList(this.listRepository, input.accessibleOwners, input.id);
    const archiving = input.status === StockCatalogStatus.ARCHIVED;
    const status = input.status ?? list.status;
    const isDefault = input.isDefault ?? list.isDefault;

    if (list.isDefault && (archiving || input.isDefault === false)) {
      throw new UnprocessableEntityException(
        archiving ? 'The default list cannot be archived' : 'Choose another default list first',
      );
    }

    if (isDefault && status === StockCatalogStatus.ARCHIVED) {
      throw new UnprocessableEntityException('An archived list cannot be the default');
    }

    const name = input.name ?? list.name;

    // Active names are unique per owner: a rename and a reactivation both have to respect that.
    if (status === StockCatalogStatus.ACTIVE) {
      const lists = await this.listRepository.findByOwners([list], false);

      if (
        lists.some(
          (other) => other.id !== list.id && other.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        throw new ConflictException('A list with this name already exists');
      }
    }

    // Spec 120 FR 10: the default market is an active market of the list owner.
    if (input.defaultMarketId) {
      const market = await this.marketRepository.findById(input.defaultMarketId);

      if (
        !market ||
        market.owner !== list.owner ||
        market.ownerId !== list.ownerId ||
        market.status !== StockCatalogStatus.ACTIVE
      ) {
        throw new UnprocessableEntityException('Choose an active market of the same owner');
      }
    }

    return this.listRepository.update({
      currency: input.currency,
      defaultFinanceCategoryId: input.defaultFinanceCategoryId,
      defaultMarketId: input.defaultMarketId,
      id: list.id,
      isDefault: input.isDefault,
      name: input.name,
      purchaseIntervalDays: input.purchaseIntervalDays,
      status: input.status,
    });
  }
}
