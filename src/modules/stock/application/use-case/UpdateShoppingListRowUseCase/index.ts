import { Inject, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  UpdateShoppingListRowInput,
  UpdateShoppingListRowSchema,
} from '@stock/application/dto/ShoppingList';
import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { loadReadableRow } from '@stock/application/service/ShoppingListAccess';
import { ShoppingRowView, toRowView } from '@stock/application/service/ShoppingListView';
import { IShoppingListRepository } from '@stock/domain/repository';
import { quantityError } from '@stock/domain/service/StockQuantity';

// Spec 118 FR 12, 15, 18 and 22: quantity (AUTO becomes AUTO_EDITED), estimated price, and the text of a text row.
export class UpdateShoppingListRowUseCase implements UseCaseWithParams<
  UpdateShoppingListRowInput,
  ShoppingRowView
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
  ) {}

  async execute(params: UpdateShoppingListRowInput): Promise<ShoppingRowView> {
    const input = validate(UpdateShoppingListRowSchema, params);
    const record = await loadReadableRow(this.listRepository, input.accessibleOwners, input.id);

    ensureOwnerWritable(input.accessibleOwners, record.list);

    if (record.row.itemId && (input.description !== undefined || input.unit !== undefined)) {
      throw new UnprocessableEntityException(
        'The description and unit of an item row come from the item',
      );
    }

    const unit = record.item?.unit ?? input.unit ?? record.row.unit;
    const error =
      input.quantity !== undefined && unit ? quantityError(unit, input.quantity) : undefined;

    if (error) {
      throw new UnprocessableEntityException(error);
    }

    const updated = await this.listRepository.updateRow({
      description: input.description,
      estimatedUnitPriceCents: input.estimatedUnitPriceCents,
      id: record.row.id,
      quantity: input.quantity,
      unit: input.unit,
    });

    return toRowView(updated);
  }
}
