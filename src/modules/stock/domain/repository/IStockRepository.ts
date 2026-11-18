import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockEntity, { StockUnits } from '@stock/domain/entity/StockEntity';
import StockMovementEntity, {
  StockMovementReasons,
  StockMovementTypes,
} from '@stock/domain/entity/StockMovementEntity';

export interface NewLotParams {
  expirationDate?: Date;
  openedAt?: Date;
  purchaseDate?: Date;
  quantity: number;
}

// One step of a movement: touch a lot (existing or new) and/or record a movement on it.
export interface MovementOperation {
  lot: { create: NewLotParams } | { id: string };
  movement?: {
    note?: string;
    quantity: number;
    reason?: StockMovementReasons;
    type: StockMovementTypes;
  };
  update?: { openedAt?: Date; quantity?: number };
}

// Runs inside the item lock with EVERY lot of the item (quantity 0 included). Throwing aborts without writing.
export type IStockRepository = {
  // Deletes the movements of the gesture and applies the plan in ONE transaction under the item lock.
  // `undefined` when the requester has no such gesture. Throwing in the planner writes nothing.
  applyGestureChange(
    gestureId: string,
    userId: string,
    planner: GesturePlanner,
  ): Promise<{ item: StockEntity } | undefined>;
  // The item with all lots (quantity > 0) after the commit; `undefined` when the item no longer exists.
  // `replayed`: the `clientId` was already applied (spec 117 FR 21): nothing was written, the stored result is returned.
  applyMovement(
    itemId: string,
    userId: string,
    planner: MovementPlanner,
    options?: MovementOptions,
  ): Promise<
    { item: StockEntity; movements: StockMovementEntity[]; replayed: boolean } | undefined
  >;
  // Item, first lot and ENTRY movement in one transaction.
  create(params: CreateStockRepositoryParams): Promise<StockEntity>;
  delete(id: string): Promise<void>;
  // Deletes every item of the owner (lots and movements cascade). Idempotent; returns the rows deleted.
  deleteByOwner(access: OwnerAccess): Promise<number>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findById(id: string): Promise<StockEntity | undefined>;
  // The items (open lots only) in the order of `ids`; unknown ids are skipped.
  findByIds(ids: string[]): Promise<StockEntity[]>;
  // Spec 117 FR 28: item ids ranked by movement count since `since` (ties by latest movement).
  findFrequentItemIds(owners: OwnerAccess[], since: Date, limit: number): Promise<string[]>;
  // Newest first; the caller asks for `limit + 1` rows to know whether another page exists.
  findByOwners(owners: OwnerAccess[], filter?: StockFilter): Promise<StockEntity[]>;
  findMovements(
    itemId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string },
  ): Promise<StockMovementEntity[]>;
  update(params: UpdateStockRepositoryParams): Promise<StockEntity>;
};
// Spec 117 FR 8/9: what a gesture change sees, inside the item lock.
export interface GestureContext {
  // Lots with a movement outside the gesture at/after it started (a later movement touched them).
  laterLotIds: string[];
  // The item with EVERY lot (quantity 0 included).
  item: StockEntity;
  // Lots that have any movement outside the gesture (so the gesture did not create them).
  foreignLotIds: string[];
  movements: StockMovementEntity[];
}
export interface GesturePlan {
  // New movements (they keep the gesture id).
  create: MovementOperation[];
  deleteLotIds: string[];
  lotUpdates: { id: string; openedAt?: null; quantity?: number }[];
}
export type GesturePlanner = (context: GestureContext) => GesturePlan;
export interface MovementOptions {
  clientId?: string;
  gestureId?: string;
}
export type MovementPlanner = (item: StockEntity) => MovementOperation[];
export interface StockFilter {
  categoryIds?: string[];
  locationIds?: string[];
}

interface CreateStockRepositoryParams {
  barcode?: string;
  brand?: string;
  categoryId?: string;
  description: string;
  firstLot?: NewLotParams;
  idealQuantity?: number;
  locationId?: string;
  minQuantity?: number;
  notes?: string;
  openedShelfLifeDays?: number;
  owner: OwnerType;
  ownerId: string;
  quickStep?: number;
  stockOnly: boolean;
  unit: StockUnits;
  userId: string;
  warnDaysClosed: number;
  warnDaysOpened: number;
}
// `undefined` = unchanged, `null` = clear the column.
interface UpdateStockRepositoryParams {
  barcode?: null | string;
  brand?: null | string;
  categoryId?: null | string;
  description?: string;
  id: string;
  idealQuantity?: null | number;
  locationId?: null | string;
  minQuantity?: null | number;
  notes?: null | string;
  openedShelfLifeDays?: null | number;
  owner?: OwnerType;
  ownerId?: string;
  quickStep?: null | number;
  stockOnly?: boolean;
  unit?: StockUnits;
  warnDaysClosed?: number;
  warnDaysOpened?: number;
}

export { CreateStockRepositoryParams, UpdateStockRepositoryParams };
