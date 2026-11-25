-- Spec 123: stored forecast on items, lot and movement prices, discard value, list purchase interval, FORECAST rows.
-- CreateEnum
CREATE TYPE "StockForecastStatus" AS ENUM ('OK', 'INSUFFICIENT_DATA', 'NO_CONSUMPTION');

-- CreateEnum
CREATE TYPE "StockDiscardValueSource" AS ENUM ('LOT', 'ITEM_LAST', 'NONE');

-- AlterEnum
ALTER TYPE "ShoppingListRowOrigin" ADD VALUE 'FORECAST';

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "forecast_computed_on" DATE,
ADD COLUMN     "forecast_daily_rate" DECIMAL(14,6),
ADD COLUMN     "forecast_empty_date" DATE,
ADD COLUMN     "forecast_leftover_date" DATE,
ADD COLUMN     "forecast_leftover_lot_id" TEXT,
ADD COLUMN     "forecast_leftover_quantity" DECIMAL(14,3),
ADD COLUMN     "forecast_min_date" DATE,
ADD COLUMN     "forecast_status" "StockForecastStatus",
ADD COLUMN     "forecast_waste_ratio_90d" DECIMAL(6,4);

-- AlterTable
ALTER TABLE "stock_shopping_lists" ADD COLUMN     "purchase_interval_days" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "stock_lots" ADD COLUMN     "currency" VARCHAR(3),
ADD COLUMN     "leftover_dismissed_at" TIMESTAMPTZ(6),
ADD COLUMN     "leftover_dismissed_quantity" DECIMAL(14,3),
ADD COLUMN     "unit_price_cents" INTEGER;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "currency" VARCHAR(3),
ADD COLUMN     "unit_price_cents" INTEGER,
ADD COLUMN     "value_cents" INTEGER,
ADD COLUMN     "value_source" "StockDiscardValueSource";

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_forecast_leftover_lot_id_fkey" FOREIGN KEY ("forecast_leftover_lot_id") REFERENCES "stock_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE INDEX "stock_items_forecast_leftover_lot_id_idx" ON "stock_items"("forecast_leftover_lot_id") WHERE "forecast_leftover_lot_id" IS NOT NULL;

-- Backfill (section 10): prices of lots and ENTRY movements from the closed purchases (unit price known, one currency
-- per lot, quantity-weighted average half-up); history of DISCARD is not re-priced.
UPDATE "stock_movements" m
SET "unit_price_cents" = r."unit_price_cents", "currency" = p."currency"
FROM "stock_purchase_rows" r
JOIN "stock_purchases" p ON p."id" = r."purchase_id"
WHERE r."entry_movement_id" = m."id" AND m."type" = 'ENTRY' AND p."status" = 'CLOSED'
  AND NOT r."unknown_price" AND r."unit_price_cents" > 0;

UPDATE "stock_lots" l
SET "unit_price_cents" = s."price", "currency" = s."currency"
FROM (
  SELECT m."lot_id", MAX(m."currency") AS "currency",
    FLOOR(SUM(m."unit_price_cents"::numeric * m."quantity") / SUM(m."quantity") + 0.5)::integer AS "price"
  FROM "stock_movements" m
  WHERE m."type" = 'ENTRY' AND m."unit_price_cents" IS NOT NULL AND m."quantity" > 0
  GROUP BY m."lot_id"
  HAVING COUNT(DISTINCT m."currency") = 1
) s
WHERE l."id" = s."lot_id" AND s."price" > 0;

UPDATE "stock_movements" SET "value_source" = 'NONE' WHERE "type" = 'DISCARD';

ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_price_check"
  CHECK (("unit_price_cents" IS NULL AND "currency" IS NULL) OR ("unit_price_cents" > 0 AND "currency" IS NOT NULL));
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_price_check"
  CHECK ("unit_price_cents" IS NULL OR ("type" = 'ENTRY' AND "unit_price_cents" > 0 AND "currency" IS NOT NULL));
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_discard_value_check"
  CHECK (("type" = 'DISCARD') = ("value_source" IS NOT NULL)
    AND ("value_cents" IS NULL OR ("type" = 'DISCARD' AND "value_cents" >= 0 AND "currency" IS NOT NULL)));
ALTER TABLE "stock_shopping_lists" ADD CONSTRAINT "stock_shopping_lists_purchase_interval_check"
  CHECK ("purchase_interval_days" BETWEEN 1 AND 90);

-- Waste screen and the 90-day waste read (FR 30, 32).
CREATE INDEX "stock_movements_discard_idx" ON "stock_movements"("item_id", "created_at") WHERE "type" = 'DISCARD';
