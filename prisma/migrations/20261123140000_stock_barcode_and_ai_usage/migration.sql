-- Spec 121: barcode normalization and uniqueness per owner, purchase row barcode, daily AI usage counters.

-- FR 1: trim, drop spaces/hyphens, UPC-A (12 digits) -> 13 digits, uppercase. A code that does not fit stays as typed (trimmed, uppercased, 64 chars).
UPDATE "stock_items"
SET "barcode" = CASE
  WHEN regexp_replace(upper(btrim("barcode")), '[[:space:]-]', '', 'g') ~ '^[0-9]{12}$'
    THEN '0' || regexp_replace(upper(btrim("barcode")), '[[:space:]-]', '', 'g')
  WHEN regexp_replace(upper(btrim("barcode")), '[[:space:]-]', '', 'g') ~ '^[0-9A-Z]{1,64}$'
    THEN regexp_replace(upper(btrim("barcode")), '[[:space:]-]', '', 'g')
  ELSE left(upper(btrim("barcode")), 64)
END
WHERE "barcode" IS NOT NULL;

UPDATE "stock_items" SET "barcode" = NULL WHERE "barcode" = '';

-- Duplicates inside one owner: the most recently updated item keeps the code, the others move it into their notes.
WITH ranked AS (
  SELECT "id", "barcode",
    row_number() OVER (PARTITION BY "owner", "owner_id", "barcode" ORDER BY "updated_at" DESC, "id") AS position
  FROM "stock_items"
  WHERE "barcode" IS NOT NULL
)
UPDATE "stock_items" AS item
SET "notes" = left(coalesce(item."notes" || E'\n', '') || 'Código de barras: ' || ranked."barcode", 1000),
    "barcode" = NULL
FROM ranked
WHERE item."id" = ranked."id" AND ranked.position > 1;

CREATE UNIQUE INDEX "stock_items_owner_barcode_key" ON "stock_items"("owner", "owner_id", "barcode") WHERE "barcode" IS NOT NULL;

ALTER TABLE "stock_purchase_rows" ADD COLUMN "barcode" VARCHAR(64);

CREATE TYPE "AiUsageKind" AS ENUM ('LIGHT', 'SEARCH');

CREATE TABLE "ai_usage_daily" (
  "user_id" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "kind" "AiUsageKind" NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("user_id", "day", "kind")
);
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
