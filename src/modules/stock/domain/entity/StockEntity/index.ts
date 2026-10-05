import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export enum StockUnits {
  GRAM = 'gram',
  KILOGRAM = 'kilogram',
  LITER = 'liter',
  MILLILITER = 'milliliter',
  UNIT = 'unit',
}

interface IStockEntity {
  createdAt: Date;
  description: string;
  id: string;
  owner: OwnerType;
  ownerId: string;
  quantity: number;
  unit: StockUnits;
  updatedAt: Date;
  // Optional properties
  barcode?: string;
  brand?: string;
  expirationDate?: Date;
  notes?: string;
  openingDate?: Date;
  purchaseDate?: Date;
}

class StockEntity {
  createdAt: Date;
  description: string;
  id: string;
  owner: OwnerType;
  ownerId: string;
  quantity: number;
  unit: StockUnits;
  updatedAt: Date;
  // Optional properties
  barcode?: string;
  brand?: string;
  expirationDate?: Date;
  notes?: string;
  openingDate?: Date;
  purchaseDate?: Date;

  constructor(params: IStockEntity) {
    this.createdAt = params.createdAt;
    this.description = params.description;
    this.id = params.id;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.quantity = params.quantity;
    this.unit = params.unit;
    this.updatedAt = params.updatedAt;
    // Optional properties
    this.barcode = params.barcode;
    this.brand = params.brand;
    this.expirationDate = params.expirationDate;
    this.notes = params.notes;
    this.openingDate = params.openingDate;
    this.purchaseDate = params.purchaseDate;
  }
}

export default StockEntity;
