import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { hasOwnerAccess, OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { IShoppingListRepository, ShoppingRowRecord } from '@stock/domain/repository';

// A list the caller cannot read answers 404 (never confirm it exists).
export async function loadReadableList(
  repository: IShoppingListRepository,
  accessibleOwners: OwnerAccess[],
  id: string,
): Promise<ShoppingListEntity> {
  const list = await repository.findById(id);

  if (!list || !hasOwnerAccess(accessibleOwners, list)) {
    throw new NotFoundException();
  }

  return list;
}
export async function loadReadableRow(
  repository: IShoppingListRepository,
  accessibleOwners: OwnerAccess[],
  rowId: string,
): Promise<ShoppingRowRecord> {
  const record = await repository.findRowById(rowId);

  if (!record || !hasOwnerAccess(accessibleOwners, record.list)) {
    throw new NotFoundException();
  }

  return record;
}
export async function loadWritableList(
  repository: IShoppingListRepository,
  accessibleOwners: OwnerAccess[],
  id: string,
): Promise<ShoppingListEntity> {
  const list = await loadReadableList(repository, accessibleOwners, id);

  ensureOwnerWritable(accessibleOwners, list);

  return list;
}
// Rows are added to active lists only.
export function ensureListActive(list: ShoppingListEntity): void {
  if (list.status !== StockCatalogStatus.ACTIVE) {
    throw new UnprocessableEntityException('The list is archived');
  }
}
// Spec 118 FR 6: an item points to an ACTIVE list of its own owner, and a stock-only item has none (422).
export async function assertItemShoppingList(
  repository: IShoppingListRepository,
  target: Pick<OwnerAccess, 'owner' | 'ownerId'>,
  listId: string,
  stockOnly: boolean,
): Promise<void> {
  if (stockOnly) {
    throw new UnprocessableEntityException('A stock-only item has no shopping list');
  }

  const list = await repository.findById(listId);

  if (
    !list ||
    list.owner !== target.owner ||
    list.ownerId !== target.ownerId ||
    list.status !== StockCatalogStatus.ACTIVE
  ) {
    throw new UnprocessableEntityException('Choose an active shopping list of the same owner');
  }
}
