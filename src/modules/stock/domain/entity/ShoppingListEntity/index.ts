import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

interface IShoppingListEntity {
  createdAt: Date;
  currency: string;
  id: string;
  isDefault: boolean;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: StockCatalogStatus;
  updatedAt: Date;
  // Optional properties
  defaultFinanceCategoryId?: string;
  defaultMarketId?: string;
}

// Spec 118 FR 1: a named shopping list of one owner (a user or a family).
class ShoppingListEntity {
  createdAt: Date;
  currency: string;
  defaultFinanceCategoryId?: string;
  defaultMarketId?: string;
  id: string;
  isDefault: boolean;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: StockCatalogStatus;
  updatedAt: Date;

  constructor(params: IShoppingListEntity) {
    this.createdAt = params.createdAt;
    this.currency = params.currency;
    this.defaultFinanceCategoryId = params.defaultFinanceCategoryId;
    this.defaultMarketId = params.defaultMarketId;
    this.id = params.id;
    this.isDefault = params.isDefault;
    this.name = params.name;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.status = params.status;
    this.updatedAt = params.updatedAt;
  }
}

export default ShoppingListEntity;
