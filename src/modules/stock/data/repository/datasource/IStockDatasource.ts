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

export interface CreateStockDatasourceParams {
  barcode?: string;
  brand?: string;
  category_id?: string;
  description: string;
  first_lot?: NewLotDatasourceParams;
  ideal_quantity?: number;
  location_id?: string;
  min_quantity?: number;
  notes?: string;
  opened_shelf_life_days?: number;
  owner: OwnerType;
  owner_id: string;
  quick_step?: number;
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
export interface MovementOperationDatasource {
  lot: { create: NewLotDatasourceParams } | { id: string };
  movement?: {
    note?: string;
    quantity: number;
    reason?: StockMovementReason;
    type: StockMovementType;
  };
  update?: { opened_at?: Date; quantity?: number };
}
export interface NewLotDatasourceParams {
  expiration_date?: Date;
  opened_at?: Date;
  purchase_date?: Date;
  quantity: number;
}
export interface StockFilterDatasourceParams {
  category_ids?: string[];
  location_ids?: string[];
}
export type StockItemWithLots = { lots: StockLot[] } & StockItem;
// Receives the locked item and ALL its lots (quantity 0 included).
export type MovementPlannerDatasource = (
  item: StockItem,
  lots: StockLot[],
) => MovementOperationDatasource[];
// `undefined` = unchanged (Prisma no-op), `null` = set NULL.
export interface IStockDatasource {
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
  findByOwners(
    owners: OwnerAccess[],
    filter?: StockFilterDatasourceParams,
  ): Promise<StockItemWithLots[]>;
  findMovements(
    itemId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string },
  ): Promise<StockMovement[]>;
  update(params: UpdateStockDatasourceParams): Promise<StockItemWithLots>;
}
export interface UpdateStockDatasourceParams {
  barcode?: null | string;
  brand?: null | string;
  category_id?: null | string;
  description?: string;
  id: string;
  ideal_quantity?: null | number;
  location_id?: null | string;
  min_quantity?: null | number;
  notes?: null | string;
  opened_shelf_life_days?: null | number;
  owner?: OwnerType;
  owner_id?: string;
  quick_step?: null | number;
  stock_only?: boolean;
  unit?: StockUnit;
  warn_days_closed?: number;
  warn_days_opened?: number;
}
