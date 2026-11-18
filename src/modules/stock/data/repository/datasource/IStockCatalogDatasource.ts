import { AccountStatus, OwnerType, StockCategory, StockLocation } from '@db/client';

export interface CreateStockCategoryDatasourceParams extends OwnerKey {
  finance_category_id?: string;
  name: string;
  parent_id?: string;
}
export interface CreateStockLocationDatasourceParams extends OwnerKey {
  name: string;
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
  deleteCategory(id: string): Promise<void>;
  deleteLocation(id: string): Promise<void>;
  findCatalogByOwners(
    keys: OwnerKey[],
  ): Promise<{ categories: StockCategory[]; locations: StockLocation[] }>;
  findCategories(key: OwnerKey): Promise<StockCategory[]>;
  findCategoryById(id: string): Promise<null | StockCategory>;
  findLocationById(id: string): Promise<null | StockLocation>;
  findLocations(key: OwnerKey): Promise<StockLocation[]>;
  setCategoryStatus(ids: string[], status: AccountStatus): Promise<void>;
  updateCategory(params: UpdateStockCategoryDatasourceParams): Promise<StockCategory>;
  updateLocation(params: UpdateStockLocationDatasourceParams): Promise<StockLocation>;
}
export interface UpdateStockCategoryDatasourceParams {
  finance_category_id?: null | string;
  id: string;
  name?: string;
  parent_id?: null | string;
}
export interface UpdateStockLocationDatasourceParams {
  id: string;
  name?: string;
  status?: AccountStatus;
}
