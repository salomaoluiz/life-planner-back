import { Injectable } from '@nestjs/common';

import { Prisma, StockMovement } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import { toOwnerWhere } from '@stock/data/datasource/mapper/OwnerWhere';
import { syncRestockRows } from '@stock/data/datasource/RestockSync';
import {
  CreateStockDatasourceParams,
  DeleteByOwnerStockDatasourceParams,
  ExistsStockDatasourceParams,
  GesturePlannerDatasource,
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
  // Spec 117 FR 8/9: delete the gesture's movements and apply the plan under the item lock.
  async applyGestureChange(
    gestureId: string,
    userId: string,
    planner: GesturePlannerDatasource,
  ): Promise<null | StockItemWithLots> {
    return this.db.client.$transaction(async (tx) => {
      const first = await tx.stockMovement.findFirst({
        where: { gesture_id: gestureId, user_id: userId },
      });

      if (!first) {
        return null;
      }

      const itemId = first.item_id;

      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "stock_items" WHERE "id" = ${itemId} FOR UPDATE`,
      );

      const movements = await tx.stockMovement.findMany({
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
        where: { gesture_id: gestureId, user_id: userId },
      });

      if (movements.length === 0) {
        return null;
      }

      const item = await tx.stockItem.findUniqueOrThrow({ where: { id: itemId } });
      const lots = await tx.stockLot.findMany({
        orderBy: { id: 'asc' },
        where: { item_id: itemId },
      });
      const startedAt = movements[0].created_at;
      const foreign = await tx.stockMovement.findMany({
        select: { created_at: true, lot_id: true },
        where: {
          lot_id: { in: [...new Set(movements.map((movement) => movement.lot_id))] },
          OR: [{ gesture_id: null }, { gesture_id: { not: gestureId } }],
        },
      });
      const plan = planner({
        foreign_lot_ids: [...new Set(foreign.map((row) => row.lot_id))],
        item,
        later_lot_ids: [
          ...new Set(foreign.filter((row) => row.created_at >= startedAt).map((row) => row.lot_id)),
        ],
        lots,
        movements,
      });

      await tx.stockMovement.deleteMany({ where: { gesture_id: gestureId, user_id: userId } });

      for (const update of plan.lot_updates) {
        await tx.stockLot.update({
          data: { opened_at: update.opened_at, quantity: update.quantity },
          where: { id: update.id },
        });
      }

      for (const operation of plan.create) {
        let lotId: string;

        if ('create' in operation.lot) {
          lotId = (await tx.stockLot.create({ data: { ...operation.lot.create, item_id: itemId } }))
            .id;
        } else {
          lotId = operation.lot.id;

          if (operation.update) {
            await tx.stockLot.update({ data: operation.update, where: { id: lotId } });
          }
        }

        if (operation.movement) {
          await tx.stockMovement.create({
            data: {
              ...operation.movement,
              gesture_id: gestureId,
              item_id: itemId,
              lot_id: lotId,
              user_id: userId,
            },
          });
        }
      }

      if (plan.delete_lot_ids.length > 0) {
        await tx.stockLot.deleteMany({ where: { id: { in: plan.delete_lot_ids } } });
      }

      // Spec 118 FR 10: undoing an entry lowers the quantity (a dismissed row may come back).
      await syncRestockRows(tx, [itemId], {
        clearDismissal: movements.some(
          (movement) => movement.type === 'ENTRY' && Number(movement.quantity) > 0,
        ),
      });

      return tx.stockItem.findUniqueOrThrow({ include: OPEN_LOTS, where: { id: itemId } });
    });
  }

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

      // Spec 118 FR 10/11: the smart row follows the new quantity; a lowering movement clears the dismissal.
      await syncRestockRows(tx, [itemId], {
        clearDismissal: movements.some((movement) => Number(movement.quantity) < 0),
      });

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
        await syncRestockRows(tx, [item.id]);

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
      await syncRestockRows(tx, [item.id]);

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

  async findByIds(ids: string[]): Promise<StockItemWithLots[]> {
    if (ids.length === 0) {
      return [];
    }

    const items = await this.db.client.stockItem.findMany({ where: { id: { in: ids } } });
    const lots = await this.db.client.stockLot.findMany({
      orderBy: { id: 'asc' },
      where: { item_id: { in: ids }, quantity: { gt: 0 } },
    });

    return items.map((item) => ({ ...item, lots: lots.filter((lot) => lot.item_id === item.id) }));
  }

  // One grouped statement over the movements of the period, joined to the owner's items.
  async findFrequentItemIds(owners: OwnerAccess[], since: Date, limit: number): Promise<string[]> {
    if (owners.length === 0) {
      return [];
    }

    const ownerClauses = owners.map(
      (access) =>
        Prisma.sql`(i."owner" = ${access.owner}::"OwnerType" AND i."owner_id" = ${access.ownerId})`,
    );
    const rows = await this.db.client.$queryRaw<{ item_id: string }[]>(Prisma.sql`
      SELECT m."item_id" AS "item_id"
      FROM "stock_movements" m
      JOIN "stock_items" i ON i."id" = m."item_id"
      WHERE m."created_at" >= ${since} AND (${Prisma.join(ownerClauses, ' OR ')})
      GROUP BY m."item_id"
      ORDER BY count(*) DESC, max(m."created_at") DESC, m."item_id" ASC
      LIMIT ${limit}
    `);

    return rows.map((row) => row.item_id);
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
        ...(filter?.barcode ? { barcode: filter.barcode } : {}),
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

    return this.db.client.$transaction(async (tx) => {
      // Spec 118 FR 8: the rows of an item that changes owner stay with the old owner: the ones the user wrote
      // (manual and edited) become text rows, the AUTO ones are removed by the sync below.
      if (data.owner !== undefined) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "stock_shopping_list_rows" r
          SET "description" = LEFT(i."description", 100), "unit" = i."unit", "item_id" = NULL,
            "estimated_unit_price_cents" = i."estimated_unit_price_cents", "origin" = 'MANUAL', "updated_at" = now()
          FROM "stock_items" i
          WHERE r."item_id" = i."id" AND i."id" = ${id} AND r."origin" IN ('MANUAL', 'AUTO_EDITED')
        `);
      }

      await tx.stockItem.update({ data, where: { id } });
      await syncRestockRows(tx, [id]);

      return tx.stockItem.findUniqueOrThrow({ include: OPEN_LOTS, where: { id } });
    });
  }
}
