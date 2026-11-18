import { Inject, Injectable } from '@nestjs/common';

import { StockUnit } from '@db/client';
import { StockMapper } from '@stock/data/datasource/mapper/StockMapper';
import { IStockDatasource } from '@stock/data/repository/datasource/IStockDatasource';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockEntity from '@stock/domain/entity/StockEntity';
import StockMovementEntity from '@stock/domain/entity/StockMovementEntity';
import {
  CreateStockRepositoryParams,
  IStockRepository,
  MovementPlanner,
  StockFilter,
  UpdateStockRepositoryParams,
} from '@stock/domain/repository';

@Injectable()
export class StockRepository implements IStockRepository {
  constructor(
    @Inject('IStockDatasource')
    private readonly stockDatasource: IStockDatasource,
  ) {}

  async applyMovement(
    itemId: string,
    userId: string,
    planner: MovementPlanner,
  ): Promise<{ item: StockEntity; movements: StockMovementEntity[] } | undefined> {
    const result = await this.stockDatasource.applyMovement(itemId, userId, (item, lots) =>
      planner(StockMapper.toDomain({ ...item, lots })).map((operation) => ({
        lot:
          'create' in operation.lot
            ? {
                create: {
                  expiration_date: operation.lot.create.expirationDate,
                  opened_at: operation.lot.create.openedAt,
                  purchase_date: operation.lot.create.purchaseDate,
                  quantity: operation.lot.create.quantity,
                },
              }
            : operation.lot,
        movement: operation.movement,
        update: operation.update && {
          opened_at: operation.update.openedAt,
          quantity: operation.update.quantity,
        },
      })),
    );

    if (!result) {
      return undefined;
    }

    return {
      item: StockMapper.toDomain(result.item),
      movements: result.movements.map((movement) => StockMapper.toMovement(movement)),
    };
  }

  async create(params: CreateStockRepositoryParams): Promise<StockEntity> {
    const result = await this.stockDatasource.create({
      barcode: params.barcode,
      brand: params.brand,
      category_id: params.categoryId,
      description: params.description,
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

  async findById(id: string): Promise<StockEntity | undefined> {
    const result = await this.stockDatasource.findById(id);

    return result ? StockMapper.toDomain(result) : undefined;
  }

  async findByOwners(owners: OwnerAccess[], filter?: StockFilter): Promise<StockEntity[]> {
    const result = await this.stockDatasource.findByOwners(
      owners,
      filter && { category_ids: filter.categoryIds, location_ids: filter.locationIds },
    );

    return result.map((row) => StockMapper.toDomain(row));
  }

  async findMovements(
    itemId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string },
  ): Promise<StockMovementEntity[]> {
    const rows = await this.stockDatasource.findMovements(itemId, limit, cursor);

    return rows.map((row) => StockMapper.toMovement(row));
  }

  async update(params: UpdateStockRepositoryParams): Promise<StockEntity> {
    const result = await this.stockDatasource.update({
      barcode: params.barcode,
      brand: params.brand,
      category_id: params.categoryId,
      description: params.description,
      id: params.id,
      ideal_quantity: params.idealQuantity,
      location_id: params.locationId,
      min_quantity: params.minQuantity,
      notes: params.notes,
      opened_shelf_life_days: params.openedShelfLifeDays,
      owner: params.owner,
      owner_id: params.ownerId,
      stock_only: params.stockOnly,
      unit: params.unit as StockUnit | undefined,
      warn_days_closed: params.warnDaysClosed,
      warn_days_opened: params.warnDaysOpened,
    });

    return StockMapper.toDomain(result);
  }
}
