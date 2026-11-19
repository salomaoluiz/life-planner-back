import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import ShoppingListRowEntity, {
  ShoppingListRowOrigins,
} from '@stock/domain/entity/ShoppingListRowEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

export interface AddShoppingListRowParams {
  description?: string;
  estimatedUnitPriceCents?: number;
  itemId?: string;
  listId: string;
  quantity: number;
  userId: string;
  // Spec 118 FR 18: the undo of a removal restores the row with its origin and clears the item's dismissal.
  origin?: ShoppingListRowOrigins;
  restore?: boolean;
  unit?: StockUnits;
}
export interface CreateShoppingListParams {
  currency: string;
  isDefault: boolean;
  name: string;
  owner: OwnerAccess['owner'];
  ownerId: string;
}
export type IShoppingListRepository = {
  // `merged`: the item was already on the list, the quantities were summed (FR 14).
  addRow(params: AddShoppingListRowParams): Promise<{ merged: boolean; row: ShoppingRowRecord }>;
  // Creates the list (clearing the previous default when `isDefault`) in one transaction.
  create(params: CreateShoppingListParams): Promise<ShoppingListEntity>;
  // Deletes the lists of the owner (rows cascade). Idempotent.
  deleteByOwner(access: OwnerAccess): Promise<void>;
  // Removes the row; an item row of an item below its minimum records the dismissal (FR 11).
  deleteRow(rowId: string, userId: string): Promise<void>;
  // The owner's active default list, created when missing (unique index: concurrent calls create one).
  ensureDefault(access: OwnerAccess, name: string): Promise<ShoppingListEntity>;
  findById(id: string): Promise<ShoppingListEntity | undefined>;
  findByOwners(owners: OwnerAccess[], includeArchived: boolean): Promise<ShoppingListEntity[]>;
  // AUTO and AUTO_EDITED rows of the ACTIVE lists of the owners (Home card).
  findRestockRows(owners: OwnerAccess[]): Promise<ShoppingRowRecord[]>;
  findRowById(id: string): Promise<ShoppingRowRecord | undefined>;
  findRowsByLists(listIds: string[]): Promise<ShoppingRowRecord[]>;
  update(params: UpdateShoppingListParams): Promise<ShoppingListEntity>;
  updateRow(params: UpdateShoppingListRowParams): Promise<ShoppingRowRecord>;
};
// A row with what the views need from its item.
export interface ShoppingRowItem {
  categoryId?: string;
  description: string;
  estimatedUnitPriceCents?: number;
  id: string;
  idealQuantity?: number;
  minQuantity?: number;
  owner: OwnerAccess['owner'];
  ownerId: string;
  quantity: number;
  unit: StockUnits;
}
export interface ShoppingRowRecord {
  item?: ShoppingRowItem;
  list: ShoppingListEntity;
  row: ShoppingListRowEntity;
}
// `undefined` = unchanged. Archiving moves the AUTO rows to the default list in the same transaction (FR 4).
export interface UpdateShoppingListParams {
  currency?: string;
  id: string;
  isDefault?: boolean;
  name?: string;
  status?: StockCatalogStatus;
}
// `undefined` = unchanged, `null` = clear the estimate.
export interface UpdateShoppingListRowParams {
  description?: string;
  estimatedUnitPriceCents?: null | number;
  id: string;
  quantity?: number;
  unit?: StockUnits;
}
