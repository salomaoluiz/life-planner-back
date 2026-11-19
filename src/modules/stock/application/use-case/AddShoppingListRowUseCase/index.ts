import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  AddShoppingListRowInput,
  AddShoppingListRowSchema,
} from '@stock/application/dto/ShoppingList';
import { ensureListActive, loadWritableList } from '@stock/application/service/ShoppingListAccess';
import { ShoppingRowView, toRowView } from '@stock/application/service/ShoppingListView';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { ShoppingListRowOrigins } from '@stock/domain/entity/ShoppingListRowEntity';
import { IShoppingListRepository, IStockRepository } from '@stock/domain/repository';
import { quantityError } from '@stock/domain/service/StockQuantity';

export interface AddShoppingListRowOutput {
  merged: boolean;
  row: ShoppingRowView;
}

// Spec 118 FR 13-15 and 18: an item row, a text row, or the restore of a removed row.
export class AddShoppingListRowUseCase implements UseCaseWithParams<
  AddShoppingListRowInput,
  AddShoppingListRowOutput
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: AddShoppingListRowInput): Promise<AddShoppingListRowOutput> {
    const input = validate(AddShoppingListRowSchema, params);
    const list = await loadWritableList(this.listRepository, input.accessibleOwners, input.listId);

    ensureListActive(list);

    let unit = input.unit;

    if (input.itemId) {
      const item = await this.stockRepository.findById(input.itemId);

      if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
        throw new NotFoundException();
      }

      // An item row only lives in a list of the item's owner, and a stock-only item has no list (422).
      if (item.owner !== list.owner || item.ownerId !== list.ownerId) {
        throw new UnprocessableEntityException('The item belongs to another owner');
      }

      if (item.stockOnly) {
        throw new UnprocessableEntityException('A stock-only item cannot go on a shopping list');
      }

      unit = item.unit;
    }

    const error = unit ? quantityError(unit, input.quantity) : undefined;

    if (error) {
      throw new UnprocessableEntityException(error);
    }

    const { merged, row } = await this.listRepository.addRow({
      description: input.description,
      estimatedUnitPriceCents: input.estimatedUnitPriceCents,
      itemId: input.itemId,
      listId: list.id,
      origin: input.origin as ShoppingListRowOrigins | undefined,
      quantity: input.quantity,
      restore: input.restore,
      unit: input.unit,
      userId: input.userId,
    });

    return { merged, row: toRowView(row) };
  }
}
