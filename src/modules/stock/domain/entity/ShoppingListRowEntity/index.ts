import { StockUnits } from '@stock/domain/entity/StockEntity';

export enum ShoppingListRowOrigins {
  AUTO = 'AUTO',
  AUTO_EDITED = 'AUTO_EDITED',
  FORECAST = 'FORECAST',
  MANUAL = 'MANUAL',
}

interface IShoppingListRowEntity {
  createdAt: Date;
  id: string;
  listId: string;
  origin: ShoppingListRowOrigins;
  quantity: number;
  updatedAt: Date;
  // Optional properties
  createdBy?: string;
  description?: string;
  estimatedUnitPriceCents?: number;
  itemId?: string;
  unit?: StockUnits;
}

// Spec 118 FR 9-14: an item row (`itemId`) or a text row (`description` + `unit`).
class ShoppingListRowEntity {
  createdAt: Date;
  createdBy?: string;
  description?: string;
  estimatedUnitPriceCents?: number;
  id: string;
  itemId?: string;
  listId: string;
  origin: ShoppingListRowOrigins;
  quantity: number;
  unit?: StockUnits;
  updatedAt: Date;

  constructor(params: IShoppingListRowEntity) {
    this.createdAt = params.createdAt;
    this.createdBy = params.createdBy;
    this.description = params.description;
    this.estimatedUnitPriceCents = params.estimatedUnitPriceCents;
    this.id = params.id;
    this.itemId = params.itemId;
    this.listId = params.listId;
    this.origin = params.origin;
    this.quantity = params.quantity;
    this.unit = params.unit;
    this.updatedAt = params.updatedAt;
  }
}

export default ShoppingListRowEntity;
