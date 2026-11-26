import {
  AccountStatus,
  OwnerType,
  StockCategory,
  StockLocation,
  StockShoppingList,
} from '@db/client';

export interface AppearanceCascadeDatasource {
  colors: Record<string, string>;
  icon?: string;
  ids: string[];
}
export interface CatalogMoveDatasource {
  from: string[];
  to: null | string;
}
export interface CreateStockCategoryDatasourceParams extends OwnerKey {
  color: string;
  finance_category_id?: string;
  icon: string;
  name: string;
  parent_id?: string;
}
export interface CreateStockLocationDatasourceParams extends OwnerKey {
  color: string;
  icon: string;
  name: string;
  parent_id?: string;
}
export interface OwnerKey {
  owner: OwnerType;
  owner_id: string;
}
// `undefined` = unchanged, `null` = set NULL.
export interface IStockCatalogDatasource {
  countItemsByCategory(key: OwnerKey): Promise<{ category_id: string; count: number }[]>;
  countItemsByLocation(key: OwnerKey): Promise<{ count: number; location_id: string }[]>;
  createCategories(params: CreateStockCategoryDatasourceParams[]): Promise<StockCategory[]>;
  createCategory(params: CreateStockCategoryDatasourceParams): Promise<StockCategory>;
  createLocation(params: CreateStockLocationDatasourceParams): Promise<StockLocation>;
  createLocations(params: CreateStockLocationDatasourceParams[]): Promise<StockLocation[]>;
  // Categories and locations of the owner (items go through IStockDatasource).
  deleteByOwner(key: OwnerKey): Promise<void>;
  deleteCategory(id: string, move?: CatalogMoveDatasource): Promise<void>;
  deleteLocation(id: string, move?: CatalogMoveDatasource): Promise<void>;
  findCatalogByOwners(keys: OwnerKey[]): Promise<{
    categories: StockCategory[];
    locations: StockLocation[];
    shopping_lists: StockShoppingList[];
  }>;
  findCategories(key: OwnerKey): Promise<StockCategory[]>;
  findCategoryById(id: string): Promise<null | StockCategory>;
  findLocationById(id: string): Promise<null | StockLocation>;
  findLocations(key: OwnerKey): Promise<StockLocation[]>;
  setCategoryStatus(ids: string[], status: AccountStatus): Promise<void>;
  setLocationStatus(ids: string[], status: AccountStatus): Promise<void>;
  updateCategory(params: UpdateStockCategoryDatasourceParams): Promise<StockCategory>;
  updateLocation(params: UpdateStockLocationDatasourceParams): Promise<StockLocation>;
}
export interface UpdateStockCategoryDatasourceParams {
  cascade?: AppearanceCascadeDatasource;
  color?: string;
  finance_category_id?: null | string;
  icon?: string;
  id: string;
  name?: string;
  parent_id?: null | string;
}
export interface UpdateStockLocationDatasourceParams {
  cascade?: AppearanceCascadeDatasource;
  color?: string;
  icon?: string;
  id: string;
  name?: string;
  parent_id?: null | string;
}
