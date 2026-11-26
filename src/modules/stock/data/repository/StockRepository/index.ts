import { Inject, Injectable } from '@nestjs/common';

import { StockUnit } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockMapper } from '@stock/data/datasource/mapper/StockMapper';
import {
  IStockDatasource,
  MovementOperationDatasource,
} from '@stock/data/repository/datasource/IStockDatasource';
import { ExpiringLot } from '@stock/domain/entity/ExpiringLot';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockEntity from '@stock/domain/entity/StockEntity';
import StockMovementEntity from '@stock/domain/entity/StockMovementEntity';
import {
  CreateStockRepositoryParams,
  GesturePlanner,
  IStockRepository,
  MovementOperation,
  MovementOptions,
  MovementPlanner,
  StockFilter,
  UpdateStockRepositoryParams,
} from '@stock/domain/repository';
import { daysBetween, effectiveExpiration } from '@stock/domain/service/LotExpiration';

function toDatasourceOperation(operation: MovementOperation): MovementOperationDatasource {
  return {
    lot:
      'create' in operation.lot
        ? {
            create: {
              currency: operation.lot.create.currency,
              expiration_date: operation.lot.create.expirationDate,
              opened_at: operation.lot.create.openedAt,
              purchase_date: operation.lot.create.purchaseDate,
              quantity: operation.lot.create.quantity,
              unit_price_cents: operation.lot.create.unitPriceCents,
            },
          }
        : operation.lot,
    movement: operation.movement && {
      currency: operation.movement.currency,
      note: operation.movement.note,
      quantity: operation.movement.quantity,
      reason: operation.movement.reason,
      type: operation.movement.type,
      unit_price_cents: operation.movement.unitPriceCents,
    },
    update: operation.update && {
      currency: operation.update.currency,
      opened_at: operation.update.openedAt,
      quantity: operation.update.quantity,
      unit_price_cents: operation.update.unitPriceCents,
    },
  };
}

@Injectable()
export class StockRepository implements IStockRepository {
  constructor(
    @Inject('IStockDatasource')
    private readonly stockDatasource: IStockDatasource,
  ) {}

  async applyGestureChange(
    gestureId: string,
    userId: string,
    planner: GesturePlanner,
  ): Promise<{ item: StockEntity } | undefined> {
    const result = await this.stockDatasource.applyGestureChange(gestureId, userId, (context) => {
      const plan = planner({
        foreignLotIds: context.foreign_lot_ids,
        item: StockMapper.toDomain({ ...context.item, lots: context.lots }),
        laterLotIds: context.later_lot_ids,
        movements: context.movements.map((movement) => StockMapper.toMovement(movement)),
      });

      return {
        create: plan.create.map((operation) => toDatasourceOperation(operation)),
        delete_lot_ids: plan.deleteLotIds,
        lot_updates: plan.lotUpdates,
      };
    });

    return result ? { item: StockMapper.toDomain(result) } : undefined;
  }

  async applyMovement(
    itemId: string,
    userId: string,
    planner: MovementPlanner,
    options?: MovementOptions,
  ): Promise<
    { item: StockEntity; movements: StockMovementEntity[]; replayed: boolean } | undefined
  > {
    const result = await this.stockDatasource.applyMovement(
      itemId,
      userId,
      (item, lots) =>
        planner(StockMapper.toDomain({ ...item, lots })).map((operation) =>
          toDatasourceOperation(operation),
        ),
      options && { client_id: options.clientId, gesture_id: options.gestureId },
    );

    if (!result) {
      return undefined;
    }

    return {
      item: StockMapper.toDomain(result.item),
      movements: result.movements.map((movement) => StockMapper.toMovement(movement)),
      replayed: result.replayed,
    };
  }

  async create(params: CreateStockRepositoryParams): Promise<StockEntity> {
    const result = await this.stockDatasource.create({
      barcode: params.barcode,
      brand: params.brand,
      category_id: params.categoryId,
      description: params.description,
      estimated_unit_price_cents: params.estimatedUnitPriceCents,
      first_lot: params.firstLot && {
        expiration_date: params.firstLot.expirationDate,
        opened_at: params.firstLot.openedAt,
        purchase_date: params.firstLot.purchaseDate,
        quantity: params.firstLot.quantity,
      },
      ideal_quantity: params.idealQuantity,
      location_id: params.locationId,
      min_quantity: params.minQuantity,
      notes: params.notes,
      opened_shelf_life_days: params.openedShelfLifeDays,
      owner: params.owner,
      owner_id: params.ownerId,
      quick_step: params.quickStep,
      shopping_list_id: params.shoppingListId,
      stock_only: params.stockOnly,
      unit: params.unit as StockUnit,
      user_id: params.userId,
      warn_days_closed: params.warnDaysClosed,
      warn_days_opened: params.warnDaysOpened,
    });

    return StockMapper.toDomain(result);
  }

  async delete(id: string): Promise<void> {
    await this.stockDatasource.delete(id);
  }

  async deleteByOwner(access: OwnerAccess): Promise<number> {
    return this.stockDatasource.deleteByOwner({ owner: access.owner, owner_id: access.ownerId });
  }

  async existsByOwner(access: OwnerAccess): Promise<boolean> {
    return this.stockDatasource.exists({ owner: access.owner, owner_id: access.ownerId });
  }

  async findById(id: string, withForecastRow = false): Promise<StockEntity | undefined> {
    const result = await this.stockDatasource.findById(id, withForecastRow);

    return result ? StockMapper.toDomain(result) : undefined;
  }

  async findByIds(ids: string[]): Promise<StockEntity[]> {
    const rows = await this.stockDatasource.findByIds(ids);

    return ids
      .map((id) => rows.find((row) => row.id === id))
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .map((row) => StockMapper.toDomain(row));
  }

  async findByLotId(lotId: string): Promise<StockEntity | undefined> {
    const result = await this.stockDatasource.findByLotId(lotId);

    return result ? StockMapper.toDomain(result) : undefined;
  }

  async findByOwners(owners: OwnerAccess[], filter?: StockFilter): Promise<StockEntity[]> {
    const result = await this.stockDatasource.findByOwners(
      owners,
      filter && {
        barcode: filter.barcode,
        category_ids: filter.categoryIds,
        location_ids: filter.locationIds,
      },
    );

    return result.map((row) => StockMapper.toDomain(row));
  }

  async findExpiringLots(owners: OwnerAccess[], today: string): Promise<ExpiringLot[]> {
    const rows = await this.stockDatasource.findExpiringLots(owners, today);
    const day = new Date(`${today}T00:00:00.000Z`);

    return rows.map((row) => {
      const expiration = effectiveExpiration(
        { expirationDate: row.expiration_date ?? undefined, openedAt: row.opened_at ?? undefined },
        row.opened_shelf_life_days ?? undefined,
      ) as Date;

      return {
        daysLeft: daysBetween(day, expiration),
        description: row.description,
        expiresOn: expiration.toISOString().slice(0, 10),
        itemId: row.item_id,
        location: row.location,
        lotId: row.lot_id,
        opened: row.opened_at !== null,
        owner: row.owner as OwnerType,
        ownerId: row.owner_id,
        quantity: row.quantity,
        unit: row.unit,
      };
    });
  }

  async findFirstDiscardDate(owners: OwnerAccess[]) {
    return this.stockDatasource.findFirstDiscardDate(owners);
  }

  async findFrequentItemIds(owners: OwnerAccess[], since: Date, limit: number): Promise<string[]> {
    return this.stockDatasource.findFrequentItemIds(owners, since, limit);
  }

  async findMovementDays(itemId: string, today: Date, windowDays: number) {
    return this.stockDatasource.findMovementDays(itemId, today, windowDays);
  }

  async findMovements(
    itemId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string },
  ): Promise<StockMovementEntity[]> {
    const rows = await this.stockDatasource.findMovements(itemId, limit, cursor);

    return rows.map((row) => StockMapper.toMovement(row));
  }

  async findStaleForecastItemIds(owners: OwnerAccess[], today: Date): Promise<string[]> {
    return this.stockDatasource.findStaleForecastItemIds(owners, today);
  }

  async findWasteGroups(
    owners: OwnerAccess[],
    range: { from: Date; previousFrom: Date; to: Date },
  ) {
    return this.stockDatasource.findWasteGroups(owners, range);
  }

  async findWasteItems(owners: OwnerAccess[], range: { from: Date; to: Date }) {
    return this.stockDatasource.findWasteItems(owners, range);
  }

  async findWasteRows(itemId: string, since: Date) {
    return this.stockDatasource.findWasteRows(itemId, since);
  }

  async refreshForecasts(itemIds: string[], today: Date): Promise<void> {
    await this.stockDatasource.refreshForecasts(itemIds, today);
  }

  async setLeftoverDismissal(lotId: string, quantity: null | number): Promise<void> {
    await this.stockDatasource.setLeftoverDismissal(lotId, quantity);
  }

  async update(params: UpdateStockRepositoryParams): Promise<StockEntity> {
    const result = await this.stockDatasource.update({
      barcode: params.barcode,
      brand: params.brand,
      category_id: params.categoryId,
      description: params.description,
      estimated_unit_price_cents: params.estimatedUnitPriceCents,
      id: params.id,
      ideal_quantity: params.idealQuantity,
      location_id: params.locationId,
      min_quantity: params.minQuantity,
      notes: params.notes,
      opened_shelf_life_days: params.openedShelfLifeDays,
      owner: params.owner,
      owner_id: params.ownerId,
      quick_step: params.quickStep,
      shopping_list_id: params.shoppingListId,
      stock_only: params.stockOnly,
      unit: params.unit as StockUnit | undefined,
      warn_days_closed: params.warnDaysClosed,
      warn_days_opened: params.warnDaysOpened,
    });

    return StockMapper.toDomain(result);
  }
}
