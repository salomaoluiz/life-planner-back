import { Injectable } from '@nestjs/common';

import { Prisma, StockMovement } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import { toOwnerWhere } from '@stock/data/datasource/mapper/OwnerWhere';
import {
  CreateStockDatasourceParams,
  DeleteByOwnerStockDatasourceParams,
  ExistsStockDatasourceParams,
  IStockDatasource,
  MovementPlannerDatasource,
  StockFilterDatasourceParams,
  StockItemWithLots,
  UpdateStockDatasourceParams,
} from '@stock/data/repository/datasource/IStockDatasource';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';

const OPEN_LOTS = { lots: { orderBy: { id: 'asc' as const }, where: { quantity: { gt: 0 } } } };

@Injectable()
export class StockDatasource implements IStockDatasource {
  constructor(private readonly db: Database) {}

  // Spec 116 FR 10: the item row is locked until commit, so movements of one item serialize and the planner
  // always sees committed lots. Nothing is written when the planner throws.
  async applyMovement(
    itemId: string,
    userId: string,
    planner: MovementPlannerDatasource,
    options?: { client_id?: string; gesture_id?: string },
  ): Promise<{ item: StockItemWithLots; movements: StockMovement[]; replayed: boolean } | null> {
    return this.db.client.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT "id" FROM "stock_items" WHERE "id" = ${itemId} FOR UPDATE`,
      );

      if (locked.length === 0) {
        return null;
      }

      // Spec 117 FR 21: a key already applied by this user answers with the stored result (the item is locked,
      // so two requests with one key never run the planner twice).
      if (options?.client_id) {
        const first = await tx.stockMovement.findFirst({
          where: { client_id: options.client_id, user_id: userId },
        });

        if (first) {
          const stored = await tx.stockMovement.findMany({
            orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
            where: first.gesture_id
              ? { gesture_id: first.gesture_id, user_id: userId }
              : { id: first.id },
          });
          const current = await tx.stockItem.findUniqueOrThrow({
            include: OPEN_LOTS,
            where: { id: itemId },
          });

          return { item: current, movements: stored, replayed: true };
        }
      }

      const item = await tx.stockItem.findUniqueOrThrow({ where: { id: itemId } });
      const lots = await tx.stockLot.findMany({
        orderBy: { id: 'asc' },
        where: { item_id: itemId },
      });
      const movements: StockMovement[] = [];

      let clientId = options?.client_id;

      for (const operation of planner(item, lots)) {
        let lotId: string;

        if ('create' in operation.lot) {
          const created = await tx.stockLot.create({
            data: { ...operation.lot.create, item_id: itemId },
          });

          lotId = created.id;
        } else {
          lotId = operation.lot.id;

          if (operation.update) {
            await tx.stockLot.update({ data: operation.update, where: { id: lotId } });
          }
        }

        if (operation.movement) {
          movements.push(
            await tx.stockMovement.create({
              data: {
                ...operation.movement,
                client_id: clientId,
                gesture_id: options?.gesture_id,
                item_id: itemId,
                lot_id: lotId,
                user_id: userId,
              },
            }),
          );
          // The key lives on the first movement only: it is unique per user.
          clientId = undefined;
        }
      }

      const after = await tx.stockItem.findUniqueOrThrow({
        include: OPEN_LOTS,
        where: { id: itemId },
      });

      return { item: after, movements, replayed: false };
    });
  }

  async create(params: CreateStockDatasourceParams): Promise<StockItemWithLots> {
    const { first_lot: firstLot, user_id: userId, ...data } = params;

    return this.db.client.$transaction(async (tx) => {
      const item = await tx.stockItem.create({ data });

      if (!firstLot || firstLot.quantity <= 0) {
        return { ...item, lots: [] };
      }

      const lot = await tx.stockLot.create({ data: { ...firstLot, item_id: item.id } });

      await tx.stockMovement.create({
        data: {
          item_id: item.id,
          lot_id: lot.id,
          quantity: lot.quantity,
          reason: 'MANUAL',
          type: 'ENTRY',
          user_id: userId,
        },
      });

      return { ...item, lots: [lot] };
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.stockItem.deleteMany({ where: { id } });
  }

  async deleteByOwner(params: DeleteByOwnerStockDatasourceParams): Promise<number> {
    const { count } = await this.db.client.stockItem.deleteMany({
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return count;
  }

  async exists(params: ExistsStockDatasourceParams): Promise<boolean> {
    const found = await this.db.client.stockItem.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return found !== null;
  }

  async findById(id: string): Promise<null | StockItemWithLots> {
    return this.db.client.stockItem.findUnique({ include: OPEN_LOTS, where: { id } });
  }

  // Two statements regardless of the item count: the items, then the open lots of those items.
  async findByOwners(
    owners: OwnerAccess[],
    filter?: StockFilterDatasourceParams,
  ): Promise<StockItemWithLots[]> {
    const items = await this.db.client.stockItem.findMany({
      orderBy: { id: 'asc' },
      where: {
        ...toOwnerWhere(owners),
        ...(filter?.category_ids ? { category_id: { in: filter.category_ids } } : {}),
        ...(filter?.location_ids ? { location_id: { in: filter.location_ids } } : {}),
      },
    });

    if (items.length === 0) {
      return [];
    }

    const lots = await this.db.client.stockLot.findMany({
      orderBy: { id: 'asc' },
      where: { item_id: { in: items.map((item) => item.id) }, quantity: { gt: 0 } },
    });

    return items.map((item) => ({ ...item, lots: lots.filter((lot) => lot.item_id === item.id) }));
  }

  async findMovements(
    itemId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string },
  ): Promise<StockMovement[]> {
    return this.db.client.stockMovement.findMany({
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: limit,
      where: {
        item_id: itemId,
        ...(cursor
          ? {
              OR: [
                { created_at: { lt: cursor.createdAt } },
                { created_at: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
    });
  }

  async update(params: UpdateStockDatasourceParams): Promise<StockItemWithLots> {
    const { id, ...data } = params;

    return this.db.client.stockItem.update({ data, include: OPEN_LOTS, where: { id } });
  }
}
