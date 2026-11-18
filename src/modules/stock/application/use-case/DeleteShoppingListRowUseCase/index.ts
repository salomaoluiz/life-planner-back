import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  DeleteShoppingListRowInput,
  DeleteShoppingListRowSchema,
} from '@stock/application/dto/ShoppingList';
import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { loadReadableRow } from '@stock/application/service/ShoppingListAccess';
import { IShoppingListRepository } from '@stock/domain/repository';

// Spec 118 FR 11 and 18: removing a row of an item below its minimum records the dismissal.
export class DeleteShoppingListRowUseCase implements UseCaseWithParams<
  DeleteShoppingListRowInput,
  void
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
  ) {}

  async execute(params: DeleteShoppingListRowInput): Promise<void> {
    const input = validate(DeleteShoppingListRowSchema, params);
    const record = await loadReadableRow(this.listRepository, input.accessibleOwners, input.id);

    ensureOwnerWritable(input.accessibleOwners, record.list);
    await this.listRepository.deleteRow(record.row.id, input.userId);
  }
}
