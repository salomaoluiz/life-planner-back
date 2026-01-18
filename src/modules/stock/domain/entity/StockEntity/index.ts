export enum StockUnits {
  GRAM = 'gram',
  KILOGRAM = 'kilogram',
  LITER = 'liter',
  MILLILITER = 'milliliter',
  UNIT = 'unit',
}

interface IStockEntity {
  description: string;
  id: string;
  ownerId: string;
  quantity: number;
  unit: StockUnits;
  // Optional properties
  barcode?: string;
  brand?: string;
  expirationDate?: Date;
  notes?: string;
  openingDate?: Date;
  purchaseDate?: Date;
}

class StockEntity {
  description: string;
  id: string;
  ownerId: string;
  quantity: number;
  unit: StockUnits;
  // Optional properties
  barcode?: string;
  brand?: string;
  expirationDate?: Date;
  notes?: string;
  openingDate?: Date;
  purchaseDate?: Date;

  constructor(params: IStockEntity) {
    this.description = params.description;
    this.id = params.id;
    this.ownerId = params.ownerId;
    this.quantity = params.quantity;
    this.unit = params.unit;
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
