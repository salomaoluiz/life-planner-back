import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';

export interface CreateStockCategoryParams {
  financeCategoryId?: string;
  name: string;
  owner: OwnerAccess['owner'];
  ownerId: string;
  parentId?: string;
}
export interface CreateStockLocationParams {
  name: string;
  owner: OwnerAccess['owner'];
  ownerId: string;
}
export type IStockCatalogRepository = {
  countItemsByCategory(ownerAccess: OwnerAccess): Promise<Map<string, number>>;
  countItemsByLocation(ownerAccess: OwnerAccess): Promise<Map<string, number>>;
  // Sets the status of every id in one transaction (a category and its subtree).
  createCategories(params: CreateStockCategoryParams[]): Promise<StockCategoryEntity[]>;
  createCategory(params: CreateStockCategoryParams): Promise<StockCategoryEntity>;
  createLocation(params: CreateStockLocationParams): Promise<StockLocationEntity>;
  createLocations(params: CreateStockLocationParams[]): Promise<StockLocationEntity[]>;
  deleteByOwner(ownerAccess: OwnerAccess): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  deleteLocation(id: string): Promise<void>;
  setCategoryStatus(ids: string[], status: StockCatalogStatus): Promise<void>;
  // Categories and locations of every owner in two statements (the views of a list or an item).
  findCatalogByOwners(owners: OwnerAccess[]): Promise<{
    categories: StockCategoryEntity[];
    locations: StockLocationEntity[];
  }>;
  findCategories(ownerAccess: OwnerAccess): Promise<StockCategoryEntity[]>;
  findCategoryById(id: string): Promise<StockCategoryEntity | undefined>;
  findLocationById(id: string): Promise<StockLocationEntity | undefined>;
  findLocations(ownerAccess: OwnerAccess): Promise<StockLocationEntity[]>;
  updateCategory(params: UpdateStockCategoryParams): Promise<StockCategoryEntity>;
  updateLocation(params: UpdateStockLocationParams): Promise<StockLocationEntity>;
};
// `undefined` = unchanged, `null` = clear.
export interface UpdateStockCategoryParams {
  financeCategoryId?: null | string;
  id: string;
  name?: string;
  parentId?: null | string;
}
export interface UpdateStockLocationParams {
  id: string;
  name?: string;
  status?: StockCatalogStatus;
}
