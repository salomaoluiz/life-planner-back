import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockLotEntity from '@stock/domain/entity/StockLotEntity';

export enum StockUnits {
  KILOGRAM = 'kilogram',
  LITER = 'liter',
  UNIT = 'unit',
}

// Spec 123: the forecast stored on the item (written only by the forecast sync).
export interface StockForecast {
  computedOn?: Date;
  dailyRate?: number;
  emptyDate?: Date;
  leftoverDate?: Date;
  leftoverLotId?: string;
  leftoverQuantity?: number;
  minDate?: Date;
  status: 'INSUFFICIENT_DATA' | 'NO_CONSUMPTION' | 'OK';
  wasteRatio90d?: number;
}

// Spec 123 FR 17/19: the FORECAST row of the item on its list, when there is one.
export interface StockForecastRow {
  listId: string;
  quantity: number;
}

interface IStockEntity {
  createdAt: Date;
  description: string;
  id: string;
  owner: OwnerType;
  ownerId: string;
  stockOnly: boolean;
  unit: StockUnits;
  updatedAt: Date;
  warnDaysClosed: number;
  warnDaysOpened: number;
  // Optional properties
  barcode?: string;
  brand?: string;
  categoryId?: string;
  estimatedUnitPriceCents?: number;
  forecast?: StockForecast;
  forecastRow?: StockForecastRow;
  idealQuantity?: number;
  locationId?: string;
  // Only the lots with quantity > 0 (spec 116 FR 6).
  lots?: StockLotEntity[];
  minQuantity?: number;
  notes?: string;
  openedShelfLifeDays?: number;
  quickStep?: number;
  shoppingListId?: string;
}

// Spec 116: the quantity lives in the lots; the item only keeps its own attributes.
class StockEntity {
  barcode?: string;
  brand?: string;
  categoryId?: string;
  createdAt: Date;
  description: string;
  estimatedUnitPriceCents?: number;
  forecast?: StockForecast;
  forecastRow?: StockForecastRow;
  id: string;
  idealQuantity?: number;
  locationId?: string;
  lots: StockLotEntity[];
  minQuantity?: number;
  notes?: string;
  openedShelfLifeDays?: number;
  owner: OwnerType;
  ownerId: string;
  quickStep?: number;
  shoppingListId?: string;
  stockOnly: boolean;
  unit: StockUnits;
  updatedAt: Date;
  warnDaysClosed: number;
  warnDaysOpened: number;

  constructor(params: IStockEntity) {
    this.barcode = params.barcode;
    this.brand = params.brand;
    this.categoryId = params.categoryId;
    this.createdAt = params.createdAt;
    this.description = params.description;
    this.estimatedUnitPriceCents = params.estimatedUnitPriceCents;
    this.forecast = params.forecast;
    this.forecastRow = params.forecastRow;
    this.id = params.id;
    this.idealQuantity = params.idealQuantity;
    this.locationId = params.locationId;
    this.lots = params.lots ?? [];
    this.minQuantity = params.minQuantity;
    this.notes = params.notes;
    this.openedShelfLifeDays = params.openedShelfLifeDays;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.quickStep = params.quickStep;
    this.shoppingListId = params.shoppingListId;
    this.stockOnly = params.stockOnly;
    this.unit = params.unit;
    this.updatedAt = params.updatedAt;
    this.warnDaysClosed = params.warnDaysClosed;
    this.warnDaysOpened = params.warnDaysOpened;
  }
}

export default StockEntity;
