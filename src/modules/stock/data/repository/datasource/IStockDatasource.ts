import {
  OwnerType,
  StockItem,
  StockLot,
  StockMovement,
  StockMovementReason,
  StockMovementType,
  StockUnit,
} from '@db/client';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { DayMovements } from '@stock/domain/service/ConsumptionForecast';
import { WasteGroupRow, WasteItemRow } from '@stock/domain/service/WasteReport';
import { WasteRow } from '@stock/domain/service/WasteSummary';

export interface CreateStockDatasourceParams {
  barcode?: string;
  brand?: string;
  category_id?: string;
  description: string;
  estimated_unit_price_cents?: number;
  first_lot?: NewLotDatasourceParams;
  ideal_quantity?: number;
  location_id?: string;
  min_quantity?: number;
  notes?: string;
  opened_shelf_life_days?: number;
  owner: OwnerType;
  owner_id: string;
  quick_step?: number;
  shopping_list_id?: string;
  stock_only: boolean;
  unit: StockUnit;
  user_id: string;
  warn_days_closed: number;
  warn_days_opened: number;
}
export interface DeleteByOwnerStockDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface ExistsStockDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface GesturePlanDatasource {
  create: MovementOperationDatasource[];
  delete_lot_ids: string[];
  lot_updates: { id: string; opened_at?: null; quantity?: number }[];
}
export type GesturePlannerDatasource = (context: {
  foreign_lot_ids: string[];
  item: StockItem;
  later_lot_ids: string[];
  lots: StockLot[];
  movements: StockMovement[];
}) => GesturePlanDatasource;
export interface MovementOperationDatasource {
  lot: { create: NewLotDatasourceParams } | { id: string };
  movement?: {
    currency?: string;
    note?: string;
    quantity: number;
    reason?: StockMovementReason;
    type: StockMovementType;
    unit_price_cents?: number;
  };
  update?: {
    currency?: string;
    opened_at?: Date | null;
    quantity?: number;
    unit_price_cents?: number;
  };
}
export interface NewLotDatasourceParams {
  currency?: string;
  expiration_date?: Date;
  opened_at?: Date;
  purchase_date?: Date;
  quantity: number;
  unit_price_cents?: number;
}
export interface StockFilterDatasourceParams {
  barcode?: string;
  category_ids?: string[];
  location_ids?: string[];
}
// `forecast_row`: the FORECAST row of the item on its list (spec 123), attached by the reads that return items.
export type StockItemWithLots = {
  forecast_row?: { list_id: string; quantity: { toString(): string } } | null;
  lots: StockLot[];
} & StockItem;
// Receives the locked item and ALL its lots (quantity 0 included).
export type MovementPlannerDatasource = (
  item: StockItem,
  lots: StockLot[],
) => MovementOperationDatasource[];
// `undefined` = unchanged (Prisma no-op), `null` = set NULL.
export interface IStockDatasource {
  applyGestureChange(
    gestureId: string,
    userId: string,
    planner: GesturePlannerDatasource,
  ): Promise<null | StockItemWithLots>;
  applyMovement(
    itemId: string,
    userId: string,
    planner: MovementPlannerDatasource,
    options?: { client_id?: string; gesture_id?: string },
  ): Promise<{ item: StockItemWithLots; movements: StockMovement[]; replayed: boolean } | null>;
  create(params: CreateStockDatasourceParams): Promise<StockItemWithLots>;
  delete(id: string): Promise<void>;
  // Rows deleted; idempotent.
  deleteByOwner(params: DeleteByOwnerStockDatasourceParams): Promise<number>;
  exists(params: ExistsStockDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<null | StockItemWithLots>;
  findByIds(ids: string[]): Promise<StockItemWithLots[]>;
  findByLotId(lotId: string): Promise<null | StockItemWithLots>;
  findByOwners(
    owners: OwnerAccess[],
    filter?: StockFilterDatasourceParams,
  ): Promise<StockItemWithLots[]>;
  findFirstDiscardDate(owners: OwnerAccess[]): Promise<Date | null>;
  findFrequentItemIds(owners: OwnerAccess[], since: Date, limit: number): Promise<string[]>;
  findMovementDays(itemId: string, today: Date, windowDays: number): Promise<DayMovements[]>;
  findMovements(
    itemId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string },
  ): Promise<StockMovement[]>;
  findStaleForecastItemIds(owners: OwnerAccess[], today: Date): Promise<string[]>;
  findWasteGroups(
    owners: OwnerAccess[],
    range: { from: Date; previousFrom: Date; to: Date },
  ): Promise<WasteGroupRow[]>;
  findWasteItems(owners: OwnerAccess[], range: { from: Date; to: Date }): Promise<WasteItemRow[]>;
  findWasteRows(itemId: string, since: Date): Promise<WasteRow[]>;
  refreshForecasts(itemIds: string[], today: Date): Promise<void>;
  setLeftoverDismissal(lotId: string, quantity: null | number): Promise<void>;
  update(params: UpdateStockDatasourceParams): Promise<StockItemWithLots>;
}
export interface UpdateStockDatasourceParams {
  barcode?: null | string;
  brand?: null | string;
  category_id?: null | string;
  description?: string;
  estimated_unit_price_cents?: null | number;
  id: string;
  ideal_quantity?: null | number;
  location_id?: null | string;
  min_quantity?: null | number;
  notes?: null | string;
  opened_shelf_life_days?: null | number;
  owner?: OwnerType;
  owner_id?: string;
  quick_step?: null | number;
  shopping_list_id?: null | string;
  stock_only?: boolean;
  unit?: StockUnit;
  warn_days_closed?: number;
  warn_days_opened?: number;
}
