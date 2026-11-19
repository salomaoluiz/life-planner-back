import { Prisma } from '@db/client';

type Tx = Prisma.TransactionClient;

// Spec 118 FR 9/10, mirroring the pure `StockRestock` rule in SQL: needs = not stock only and quantity <= minimum
// (0 without one); the AUTO quantity is ideal - quantity (1 without an ideal, or when it would not be positive).
// `effective_list_id` = the item's list when it is active and of the same owner, else the owner's default list.
function facts(itemIds: string[]) {
  const ids = Prisma.join(itemIds);

  return Prisma.sql`(
    SELECT i."id" AS "item_id", i."owner" AS "owner", i."owner_id" AS "owner_id", i."stock_only" AS "stock_only",
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
  )`;
}

// Keeps the AUTO rows of the items in step (a stock-only item keeps no automatic row at all), inside the caller's transaction (three statements for any number of
// items). `clearDismissal`: the change lowered the quantity, so a removed row may come back (FR 11).
export async function syncRestockRows(
  tx: Tx,
  itemIds: string[],
  options: { clearDismissal?: boolean; expanded?: boolean } = {},
): Promise<void> {
  if (itemIds.length === 0) {
    return;
  }

  const clear = options.clearDismissal ?? false;

  await tx.$executeRaw(Prisma.sql`
    WITH f AS MATERIALIZED ${facts(itemIds)},
    cleared AS (
      DELETE FROM "stock_restock_dismissals" d USING f
      WHERE d."item_id" = f."item_id" AND (${clear}::boolean OR NOT f."needs")
    )
    DELETE FROM "stock_shopping_list_rows" r USING f
    WHERE r."item_id" = f."item_id"
      AND ((r."origin" = 'AUTO' AND (NOT f."needs" OR r."list_id" IS DISTINCT FROM f."effective_list_id"))
        OR (r."origin" = 'AUTO_EDITED' AND f."stock_only"))
  `);
  const createdDefaults = await tx.$executeRaw(Prisma.sql`
    INSERT INTO "stock_shopping_lists" ("id", "owner", "owner_id", "name", "is_default", "status", "currency", "updated_at")
    SELECT DISTINCT ON (f."owner", f."owner_id") gen_random_uuid()::text, f."owner", f."owner_id", 'Mercado', true, 'ACTIVE', 'BRL', now()
    FROM ${facts(itemIds)} f
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
    SELECT gen_random_uuid()::text, f."effective_list_id", f."item_id", f."restock_qty", 'AUTO', now()
    FROM ${facts(itemIds)} f
    WHERE f."needs"
      AND NOT EXISTS (SELECT 1 FROM "stock_restock_dismissals" d WHERE d."item_id" = f."item_id")
      AND f."effective_list_id" IS NOT NULL
    ON CONFLICT ("list_id", "item_id") WHERE "item_id" IS NOT NULL
    DO UPDATE SET "quantity" = EXCLUDED."quantity", "updated_at" = now()
    WHERE "stock_shopping_list_rows"."origin" = 'AUTO'
  `);
}

// Spec 118 FR 11: removing a row of an item that still needs restocking records the dismissal.
export async function dismissIfNeeded(tx: Tx, itemId: string, userId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "stock_restock_dismissals" ("item_id", "dismissed_by")
    SELECT f."item_id", ${userId} FROM ${facts([itemId])} f WHERE f."needs"
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
    { expanded: true },
  );
}
