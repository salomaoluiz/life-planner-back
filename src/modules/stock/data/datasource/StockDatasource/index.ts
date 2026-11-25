import { Injectable } from '@nestjs/common';

import { Prisma, StockMovement } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import { readItemMovementDays, recomputeForecasts } from '@stock/data/datasource/ForecastSync';
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
import { discardValue } from '@stock/domain/service/LotPrice';
import { todayUtc } from '@stock/domain/service/Today';
import { WasteGroupRow, WasteItemRow } from '@stock/domain/service/WasteReport';
import { WasteRow } from '@stock/domain/service/WasteSummary';

const OPEN_LOTS = { lots: { orderBy: { id: 'asc' as const }, where: { quantity: { gt: 0 } } } };

// Spec 123 FR 17/19: attaches the FORECAST row of each item (one indexed statement for all of them).
function ownerClauses(owners: OwnerAccess[]): Prisma.Sql {
  return Prisma.join(
    owners.map(
      (access) =>
        Prisma.sql`(i."owner" = ${access.owner}::"OwnerType" AND i."owner_id" = ${access.ownerId})`,
    ),
    ' OR ',
  );
}
async function withForecastRows<T extends { id: string }>(
  client: Pick<Prisma.TransactionClient, 'stockShoppingListRow'>,
  items: T[],
): Promise<({ forecast_row: { list_id: string; quantity: Prisma.Decimal } | null } & T)[]> {
  const rows =
    items.length === 0
      ? []
      : await client.stockShoppingListRow.findMany({
          select: { item_id: true, list_id: true, quantity: true },
          where: { item_id: { in: items.map((item) => item.id) }, origin: 'FORECAST' },
        });

  return items.map((item) => {
    const row = rows.find((candidate) => candidate.item_id === item.id);

    return { ...item, forecast_row: row ? { list_id: row.list_id, quantity: row.quantity } : null };
  });
}

// Spec 123 FR 27: the value of a DISCARD, recorded when it happens: lot price, else the last price paid for the item
// (any market), else none. Never recomputed afterwards.
async function discardFields(
  tx: Prisma.TransactionClient,
  itemId: string,
  lot: { currency: null | string; unit_price_cents: null | number } | undefined,
  quantity: number,
) {
  const last =
    lot?.unit_price_cents === null || lot?.unit_price_cents === undefined
      ? await tx.stockPriceHistory.findFirst({
          orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
          select: { currency: true, unit_price_cents: true },
          where: { item_id: itemId },
        })
      : null;
  const value = discardValue({
    lastPrice: last
      ? { currency: last.currency, unitPriceCents: last.unit_price_cents }
      : undefined,
    lotCurrency: lot?.currency ?? undefined,
    lotPriceCents: lot?.unit_price_cents ?? undefined,
    quantity: Math.abs(quantity),
  });

  return {
    currency: value.currency,
    value_cents: value.valueCents,
    value_source: value.source,
  };
}

// Spec 123 FR 25: any movement on a lot clears its dismissed leftover warning.
async function clearLeftoverDismissals(
  tx: Prisma.TransactionClient,
  lotIds: string[],
): Promise<void> {
  if (lotIds.length === 0) {
    return;
  }

  await tx.stockLot.updateMany({
    data: { leftover_dismissed_at: null, leftover_dismissed_quantity: null },
    where: { id: { in: lotIds }, leftover_dismissed_at: { not: null } },
  });
}

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

      const touched = new Set<string>(plan.lot_updates.map((update) => update.id));

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

        touched.add(lotId);

        if (operation.movement) {
          await tx.stockMovement.create({
            data: {
              ...operation.movement,
              ...(operation.movement.type === 'DISCARD'
                ? await discardFields(
                    tx,
                    itemId,
                    lots.find((candidate) => candidate.id === lotId),
                    operation.movement.quantity,
                  )
                : {}),
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

      await clearLeftoverDismissals(tx, [...touched]);
      // Spec 118 FR 10: undoing an entry lowers the quantity (a dismissed row may come back).
      await syncRestockRows(tx, [itemId], {
        clearDismissal: movements.some(
          (movement) => movement.type === 'ENTRY' && Number(movement.quantity) > 0,
        ),
      });

      return (
        await withForecastRows(tx, [
          await tx.stockItem.findUniqueOrThrow({ include: OPEN_LOTS, where: { id: itemId } }),
        ])
      )[0];
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

          return {
            item: (await withForecastRows(tx, [current]))[0],
            movements: stored,
            replayed: true,
          };
        }
      }

      const item = await tx.stockItem.findUniqueOrThrow({ where: { id: itemId } });
      const lots = await tx.stockLot.findMany({
        orderBy: { id: 'asc' },
        where: { item_id: itemId },
      });
      const movements: StockMovement[] = [];

      let clientId = options?.client_id;
      const touched = new Set<string>();

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

        touched.add(lotId);

        if (operation.movement) {
          movements.push(
            await tx.stockMovement.create({
              data: {
                ...operation.movement,
                ...(operation.movement.type === 'DISCARD'
                  ? await discardFields(
                      tx,
                      itemId,
                      lots.find((candidate) => candidate.id === lotId),
                      operation.movement.quantity,
                    )
                  : {}),
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

      await clearLeftoverDismissals(tx, [...touched]);
      // Spec 118 FR 10/11: the smart row follows the new quantity; a lowering movement clears the dismissal.
      await syncRestockRows(tx, [itemId], {
        clearDismissal: movements.some((movement) => Number(movement.quantity) < 0),
      });

      const after = await tx.stockItem.findUniqueOrThrow({
        include: OPEN_LOTS,
        where: { id: itemId },
      });

      return { item: (await withForecastRows(tx, [after]))[0], movements, replayed: false };
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

  // Spec 123 FR 14: the items of the owners whose forecast was not computed today (stock-only items have none).
  async findByLotId(lotId: string): Promise<null | StockItemWithLots> {
    const lot = await this.db.client.stockLot.findUnique({
      select: { item_id: true },
      where: { id: lotId },
    });

    return lot ? this.findById(lot.item_id) : null;
  }

  async findFirstDiscardDate(owners: OwnerAccess[]): Promise<Date | null> {
    if (owners.length === 0) {
      return null;
    }

    const [row] = await this.db.client.$queryRaw<{ first: Date | null }[]>(Prisma.sql`
      SELECT MIN(m."created_at") AS "first"
      FROM "stock_movements" m JOIN "stock_items" i ON i."id" = m."item_id"
      WHERE m."type" = 'DISCARD' AND (${ownerClauses(owners)})
    `);

    return row?.first ?? null;
  }

  async findMovementDays(itemId: string, today: Date, windowDays: number) {
    return readItemMovementDays(this.db.client, itemId, today, windowDays);
  }

  async findStaleForecastItemIds(owners: OwnerAccess[], today: Date): Promise<string[]> {
    if (owners.length === 0) {
      return [];
    }

    const items = await this.db.client.stockItem.findMany({
      select: { id: true },
      where: {
        ...toOwnerWhere(owners),
        OR: [{ forecast_computed_on: null }, { forecast_computed_on: { lt: today } }],
        stock_only: false,
      },
    });

    return items.map((item) => item.id);
  }

  // Spec 123 FR 30: totals (period x currency), reasons and categories of the month AND the previous month, one
  // grouped statement over the partial DISCARD index.
  async findWasteGroups(
    owners: OwnerAccess[],
    range: { from: Date; previousFrom: Date; to: Date },
  ): Promise<WasteGroupRow[]> {
    if (owners.length === 0) {
      return [];
    }

    const rows = await this.db.client.$queryRaw<
      {
        category_id: null | string;
        count: number;
        currency: null | string;
        items: number;
        period: 'CURRENT' | 'PREVIOUS';
        reason: null | string;
        scope: 'CATEGORY' | 'REASON' | 'TOTAL';
        unpriced: number;
        value: number;
      }[]
    >(Prisma.sql`
      SELECT t."period", t."currency",
        CASE WHEN GROUPING(t."reason") = 0 THEN 'REASON' WHEN GROUPING(t."category_id") = 0 THEN 'CATEGORY' ELSE 'TOTAL' END AS "scope",
        t."reason", t."category_id", COUNT(*)::int AS "count", COUNT(DISTINCT t."item_id")::int AS "items",
        (COUNT(*) FILTER (WHERE t."value_source" = 'NONE'))::int AS "unpriced",
        COALESCE(SUM(t."value_cents"), 0)::int AS "value"
      FROM (
        SELECT CASE WHEN m."created_at" >= ${range.from} THEN 'CURRENT' ELSE 'PREVIOUS' END AS "period",
          m."reason"::text AS "reason", m."currency", m."value_cents", m."value_source"::text AS "value_source",
          m."item_id", i."category_id"
        FROM "stock_movements" m JOIN "stock_items" i ON i."id" = m."item_id"
        WHERE m."type" = 'DISCARD' AND m."created_at" >= ${range.previousFrom} AND m."created_at" < ${range.to}
          AND (${ownerClauses(owners)})
      ) t
      GROUP BY GROUPING SETS (
        (t."period", t."currency"),
        (t."period", t."reason", t."currency"),
        (t."period", t."category_id", t."currency")
      )
    `);

    return rows.map((row) => ({
      categoryId: row.scope === 'CATEGORY' ? row.category_id : undefined,
      count: row.count,
      currency: row.currency,
      items: row.items,
      period: row.period,
      reason: row.scope === 'REASON' ? (row.reason ?? undefined) : undefined,
      scope: row.scope,
      unpriced: row.unpriced,
      valueCents: row.value,
    }));
  }

  async findWasteItems(
    owners: OwnerAccess[],
    range: { from: Date; to: Date },
  ): Promise<WasteItemRow[]> {
    if (owners.length === 0) {
      return [];
    }

    const rows = await this.db.client.$queryRaw<
      {
        count: number;
        currency: null | string;
        description: string;
        item_id: string;
        quantity: number;
        reason: string;
        unit: string;
        value: number;
      }[]
    >(Prisma.sql`
      SELECT m."item_id" AS "item_id", i."description" AS "description", i."unit"::text AS "unit",
        m."reason"::text AS "reason", m."currency" AS "currency", COUNT(*)::int AS "count",
        SUM(-m."quantity")::float8 AS "quantity", COALESCE(SUM(m."value_cents"), 0)::int AS "value"
      FROM "stock_movements" m JOIN "stock_items" i ON i."id" = m."item_id"
      WHERE m."type" = 'DISCARD' AND m."created_at" >= ${range.from} AND m."created_at" < ${range.to}
        AND (${ownerClauses(owners)})
      GROUP BY m."item_id", i."description", i."unit", m."reason", m."currency"
    `);

    return rows.map((row) => ({
      count: row.count,
      currency: row.currency,
      description: row.description,
      itemId: row.item_id,
      quantity: row.quantity,
      reason: row.reason,
      unit: row.unit,
      valueCents: row.value,
    }));
  }

  async findWasteRows(itemId: string, since: Date): Promise<WasteRow[]> {
    const rows = await this.db.client.$queryRaw<
      { count: number; currency: null | string; quantity: number; reason: string; value: number }[]
    >(Prisma.sql`
      SELECT m."reason"::text AS "reason", m."currency" AS "currency", COUNT(*)::int AS "count",
        SUM(-m."quantity")::float8 AS "quantity", COALESCE(SUM(m."value_cents"), 0)::int AS "value"
      FROM "stock_movements" m
      WHERE m."item_id" = ${itemId} AND m."type" = 'DISCARD' AND m."created_at" >= ${since}
      GROUP BY 1, 2
    `);

    return rows.map((row) => ({
      count: row.count,
      currency: row.currency ?? undefined,
      quantity: row.quantity,
      reason: row.reason,
      valueCents: row.value,
    }));
  }

  // The forecast of the items (one grouped read, one batched update) and their automatic rows, in one transaction.
  async refreshForecasts(itemIds: string[], today: Date): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }

    await this.db.client.$transaction(async (tx) => syncRestockRows(tx, itemIds, { today }));
  }

  // Spec 123 FR 25: `quantity` null clears the dismissal.
  async findById(id: string, withForecastRow = false): Promise<null | StockItemWithLots> {
    const item = await this.db.client.stockItem.findUnique({ include: OPEN_LOTS, where: { id } });

    return item && withForecastRow ? (await withForecastRows(this.db.client, [item]))[0] : item;
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

    return withForecastRows(
      this.db.client,
      items.map((item) => ({ ...item, lots: lots.filter((lot) => lot.item_id === item.id) })),
    );
  }

  async setLeftoverDismissal(lotId: string, quantity: null | number): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const lot = await tx.stockLot.update({
        data:
          quantity === null
            ? { leftover_dismissed_at: null, leftover_dismissed_quantity: null }
            : { leftover_dismissed_at: new Date(), leftover_dismissed_quantity: quantity },
        select: { item_id: true },
        where: { id: lotId },
      });

      // The stored leftover follows the dismissal (the forecast is the only place the warning is read from).
      await recomputeForecasts(tx, [lot.item_id], todayUtc());
    });
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

    return withForecastRows(
      this.db.client,
      items.map((item) => ({ ...item, lots: lots.filter((lot) => lot.item_id === item.id) })),
    );
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

      return (
        await withForecastRows(tx, [
          await tx.stockItem.findUniqueOrThrow({ include: OPEN_LOTS, where: { id } }),
        ])
      )[0];
    });
  }
}
