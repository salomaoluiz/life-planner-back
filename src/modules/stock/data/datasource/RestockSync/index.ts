import { Prisma } from '@db/client';
import { recomputeForecasts } from '@stock/data/datasource/ForecastSync';
import { todayUtc } from '@stock/domain/service/Today';

type Tx = Prisma.TransactionClient;

// Spec 118 FR 9/10, mirroring the pure `StockRestock` rule in SQL: needs = not stock only and quantity <= minimum
// (0 without one); the AUTO quantity is ideal - quantity (1 without an ideal, or when it would not be positive).
// `effective_list_id` = the item's list when it is active and of the same owner, else the owner's default list.
// Spec 123 FR 15/16: `wants_forecast` = the stored forecast is OK, the item reaches its minimum on or before the next
// trip of its effective list and `forecast_qty` (rounded up, mirror of `forecastQuantity`) is positive. The next trip
// mirrors `nextTripDate` (last CLOSED purchase + interval, rolled forward; no purchase: today + interval).
function facts(itemIds: string[], today: Date) {
  const ids = Prisma.join(itemIds);

  return Prisma.sql`(
    SELECT b.*,
      (NOT b."needs" AND NOT b."stock_only" AND b."forecast_status" = 'OK' AND b."effective_list_id" IS NOT NULL
        AND b."forecast_min_date" <= b."next_trip" AND b."forecast_qty" > 0) AS "wants_forecast"
    FROM (
      SELECT c.*,
        CASE WHEN c."forecast_status" IS DISTINCT FROM 'OK' OR c."next_trip" IS NULL THEN 0
             WHEN c."raw_qty" <= 0 THEN 0
             WHEN c."unit" = 'unit' THEN CEIL(c."raw_qty" - 0.000001)
             ELSE CEIL(c."raw_qty" * 1000 - 0.000001) / 1000 END AS "forecast_qty"
      FROM (
        SELECT a.*,
          CASE WHEN a."ideal_quantity" IS NULL THEN a."forecast_daily_rate" * a."interval_days"
               ELSE a."ideal_quantity" - GREATEST(0, a."qty" - a."forecast_daily_rate" * (a."next_trip" - ${today}::date))
          END AS "raw_qty"
        FROM (
          SELECT f.*, l."purchase_interval_days" AS "interval_days",
            CASE WHEN l."id" IS NULL THEN NULL
                 WHEN lc."last_closed" IS NULL THEN ${today}::date + l."purchase_interval_days"
                 ELSE lc."last_closed" + l."purchase_interval_days" * GREATEST(1,
                   CEIL((${today}::date - lc."last_closed")::numeric / l."purchase_interval_days")::int)
            END AS "next_trip"
          FROM (
            SELECT i."id" AS "item_id", i."owner" AS "owner", i."owner_id" AS "owner_id", i."stock_only" AS "stock_only",
              i."unit"::text AS "unit", i."ideal_quantity" AS "ideal_quantity", COALESCE(q."qty", 0) AS "qty",
              i."forecast_status"::text AS "forecast_status", i."forecast_daily_rate" AS "forecast_daily_rate",
              i."forecast_min_date" AS "forecast_min_date",
              (NOT i."stock_only" AND COALESCE(q."qty", 0) <= COALESCE(i."min_quantity", 0)) AS "needs",
              CASE WHEN i."ideal_quantity" IS NULL THEN 1
                   WHEN i."ideal_quantity" - COALESCE(q."qty", 0) > 0 THEN i."ideal_quantity" - COALESCE(q."qty", 0)
                   ELSE 1 END AS "restock_qty",
              COALESCE(
                (SELECT s."id" FROM "stock_shopping_lists" s
                  WHERE s."id" = i."shopping_list_id" AND s."status" = 'ACTIVE'
                    AND s."owner" = i."owner" AND s."owner_id" = i."owner_id"),
                (SELECT s."id" FROM "stock_shopping_lists" s
                  WHERE s."owner" = i."owner" AND s."owner_id" = i."owner_id" AND s."is_default")
              ) AS "effective_list_id"
            FROM "stock_items" i
            LEFT JOIN (
              SELECT "item_id", SUM("quantity") AS "qty" FROM "stock_lots"
              WHERE "item_id" IN (${ids}) GROUP BY "item_id"
            ) q ON q."item_id" = i."id"
            WHERE i."id" IN (${ids})
          ) f
          LEFT JOIN "stock_shopping_lists" l ON l."id" = f."effective_list_id"
          LEFT JOIN LATERAL (
            SELECT MAX(p."purchase_date") AS "last_closed" FROM "stock_purchases" p
            WHERE p."list_id" = l."id" AND p."status" = 'CLOSED'
          ) lc ON true
        ) a
      ) c
    ) b
  )`;
}

// Keeps the automatic rows of the items in step (AUTO at the minimum, FORECAST before the next trip; a stock-only item
// keeps no automatic row at all), inside the caller's transaction (three statements for any number of items).
// `clearDismissal`: the change lowered the quantity, so a removed row may come back (FR 11).
export async function syncRestockRows(
  tx: Tx,
  itemIds: string[],
  options: {
    clearDismissal?: boolean;
    expanded?: boolean;
    // Spec 123 FR 13: `recompute` (default) refreshes the stored forecast of the items first; `reuse` is for changes that
    // do not move quantities (lists, intervals) and for the callers that just recomputed.
    forecast?: 'recompute' | 'reuse';
    today?: Date;
  } = {},
): Promise<void> {
  if (itemIds.length === 0) {
    return;
  }

  const clear = options.clearDismissal ?? false;
  const today = options.today ?? todayUtc();

  if ((options.forecast ?? 'recompute') === 'recompute') {
    await recomputeForecasts(tx, itemIds, today);
  }

  await tx.$executeRaw(Prisma.sql`
    WITH f AS MATERIALIZED ${facts(itemIds, today)},
    cleared AS (
      DELETE FROM "stock_restock_dismissals" d USING f
      WHERE d."item_id" = f."item_id" AND (${clear}::boolean OR (NOT f."needs" AND NOT f."wants_forecast"))
    )
    DELETE FROM "stock_shopping_list_rows" r USING f
    WHERE r."item_id" = f."item_id"
      AND ((r."origin" = 'AUTO' AND (NOT f."needs" OR r."list_id" IS DISTINCT FROM f."effective_list_id"))
        OR (r."origin" = 'FORECAST'
          AND ((NOT f."needs" AND NOT f."wants_forecast") OR r."list_id" IS DISTINCT FROM f."effective_list_id"))
        OR (r."origin" = 'AUTO_EDITED' AND f."stock_only"))
  `);
  const createdDefaults = await tx.$executeRaw(Prisma.sql`
    INSERT INTO "stock_shopping_lists" ("id", "owner", "owner_id", "name", "is_default", "status", "currency", "updated_at")
    SELECT DISTINCT ON (f."owner", f."owner_id") gen_random_uuid()::text, f."owner", f."owner_id", 'Mercado', true, 'ACTIVE', 'BRL', now()
    FROM ${facts(itemIds, today)} f
    WHERE f."needs" AND f."effective_list_id" IS NULL
    ON CONFLICT DO NOTHING
  `);

  // Spec 118 section 10: the first default list of an owner brings the rows of every item already below its
  // minimum (no backfill migration).
  if (createdDefaults > 0 && !options.expanded) {
    const owners = await tx.stockItem.findMany({
      distinct: ['owner', 'owner_id'],
      select: { owner: true, owner_id: true },
      where: { id: { in: itemIds } },
    });

    await syncOwnerRows(tx, owners);
  }

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "stock_shopping_list_rows" ("id", "list_id", "item_id", "quantity", "origin", "updated_at")
    SELECT gen_random_uuid()::text, f."effective_list_id", f."item_id",
      CASE WHEN f."needs" THEN f."restock_qty" ELSE f."forecast_qty" END,
      CASE WHEN f."needs" THEN 'AUTO' ELSE 'FORECAST' END::"ShoppingListRowOrigin", now()
    FROM ${facts(itemIds, today)} f
    WHERE (f."needs" OR f."wants_forecast")
      AND NOT EXISTS (SELECT 1 FROM "stock_restock_dismissals" d WHERE d."item_id" = f."item_id")
      AND f."effective_list_id" IS NOT NULL
    ON CONFLICT ("list_id", "item_id") WHERE "item_id" IS NOT NULL
    DO UPDATE SET "quantity" = EXCLUDED."quantity", "origin" = EXCLUDED."origin", "updated_at" = now()
    WHERE "stock_shopping_list_rows"."origin" IN ('AUTO', 'FORECAST')
  `);
}

// Spec 118 FR 11: removing a row of an item that still needs restocking (or, spec 123, still has a forecast row)
// records the dismissal.
export async function dismissIfNeeded(
  tx: Tx,
  itemId: string,
  userId: string,
  today: Date = todayUtc(),
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "stock_restock_dismissals" ("item_id", "dismissed_by")
    SELECT f."item_id", ${userId} FROM ${facts([itemId], today)} f WHERE f."needs" OR f."wants_forecast"
    ON CONFLICT DO NOTHING
  `);
}

// Every item of the owners, in one sync (first default list, see above).
export async function syncOwnerRows(
  tx: Tx,
  owners: { owner: 'FAMILY' | 'USER'; owner_id: string }[],
): Promise<void> {
  if (owners.length === 0) {
    return;
  }

  const items = await tx.stockItem.findMany({ select: { id: true }, where: { OR: owners } });

  await syncRestockRows(
    tx,
    items.map((item) => item.id),
    { expanded: true, forecast: 'reuse' },
  );
}
