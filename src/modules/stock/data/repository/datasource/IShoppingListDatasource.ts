import {
  AccountStatus,
  OwnerType,
  ShoppingListRowOrigin,
  StockItem,
  StockLot,
  StockShoppingList,
  StockShoppingListRow,
  StockUnit,
} from '@db/client';

export interface AddShoppingListRowDatasourceParams {
  description?: string;
  estimated_unit_price_cents?: number;
  item_id?: string;
  list_id: string;
  origin?: ShoppingListRowOrigin;
  quantity: number;
  restore?: boolean;
  unit?: StockUnit;
  user_id: string;
}
export interface CreateShoppingListDatasourceParams {
  currency: string;
  is_default: boolean;
  name: string;
  owner: OwnerType;
  owner_id: string;
}
export interface IShoppingListDatasource {
  addRow(
    params: AddShoppingListRowDatasourceParams,
  ): Promise<{ merged: boolean; row: ShoppingRowWithItem }>;
  create(params: CreateShoppingListDatasourceParams): Promise<StockShoppingList>;
  deleteByOwner(key: { owner: OwnerType; owner_id: string }): Promise<void>;
  deleteRow(rowId: string, userId: string): Promise<void>;
  ensureDefault(
    key: { owner: OwnerType; owner_id: string },
    name: string,
  ): Promise<StockShoppingList>;
  findById(id: string): Promise<null | StockShoppingList>;
  findByOwners(
    keys: { owner: OwnerType; owner_id: string }[],
    includeArchived: boolean,
  ): Promise<StockShoppingList[]>;
  findRestockRows(keys: { owner: OwnerType; owner_id: string }[]): Promise<ShoppingRowWithItem[]>;
  findRowById(id: string): Promise<null | ShoppingRowWithItem>;
  findRowsByLists(listIds: string[]): Promise<ShoppingRowWithItem[]>;
  update(params: UpdateShoppingListDatasourceParams): Promise<StockShoppingList>;
  updateRow(params: UpdateShoppingListRowDatasourceParams): Promise<ShoppingRowWithItem>;
}
export type ShoppingRowWithItem = {
  item: ({ lots: StockLot[] } & StockItem) | null;
  list: StockShoppingList;
} & StockShoppingListRow;
// `undefined` = unchanged (Prisma no-op), `null` = set NULL.
export interface UpdateShoppingListDatasourceParams {
  currency?: string;
  default_finance_category_id?: null | string;
  default_market_id?: null | string;
  id: string;
  is_default?: boolean;
  name?: string;
  status?: AccountStatus;
}
export interface UpdateShoppingListRowDatasourceParams {
  description?: string;
  estimated_unit_price_cents?: null | number;
  id: string;
  quantity?: number;
  unit?: StockUnit;
}
