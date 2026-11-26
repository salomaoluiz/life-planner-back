import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';

// Spec 125 FR 12: the icon and tones a parent pushes to its active descendants in the same transaction.
export interface AppearanceCascade {
  colors: Record<string, string>;
  icon?: string;
  ids: string[];
}
// Spec 125 FR 22: where the items of the deleted subtree go (`to: null` = no category/location).
export interface CatalogMove {
  from: string[];
  to: null | string;
}
export interface CreateStockCategoryParams {
  color: string;
  financeCategoryId?: string;
  icon: string;
  name: string;
  owner: OwnerAccess['owner'];
  ownerId: string;
  parentId?: string;
}
export interface CreateStockLocationParams {
  color: string;
  icon: string;
  name: string;
  owner: OwnerAccess['owner'];
  ownerId: string;
  parentId?: string;
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
  deleteCategory(id: string, move?: CatalogMove): Promise<void>;
  deleteLocation(id: string, move?: CatalogMove): Promise<void>;
  setCategoryStatus(ids: string[], status: StockCatalogStatus): Promise<void>;
  setLocationStatus(ids: string[], status: StockCatalogStatus): Promise<void>;
  // Categories and locations of every owner in two statements (the views of a list or an item).
  findCatalogByOwners(owners: OwnerAccess[]): Promise<{
    categories: StockCategoryEntity[];
    locations: StockLocationEntity[];
    shoppingLists: ShoppingListEntity[];
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
  cascade?: AppearanceCascade;
  color?: string;
  financeCategoryId?: null | string;
  icon?: string;
  id: string;
  name?: string;
  parentId?: null | string;
}
export interface UpdateStockLocationParams {
  cascade?: AppearanceCascade;
  color?: string;
  icon?: string;
  id: string;
  name?: string;
  parentId?: null | string;
}
