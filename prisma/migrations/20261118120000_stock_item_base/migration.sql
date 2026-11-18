-- Spec 116: stock lots, immutable movements, categories, locations, decimal kg/L and name embeddings.
-- Prerequisite: the `vector` extension (pgvector) must be installed on the server.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "StockMovementType" AS ENUM ('ENTRY', 'CONSUME', 'OPEN', 'DISCARD', 'ADJUST', 'INITIAL');
CREATE TYPE "StockMovementReason" AS ENUM ('PURCHASE', 'MANUAL', 'EXPIRED', 'SPOILED', 'OTHER');

-- Catalogs
CREATE TABLE "stock_categories" (
  "id" TEXT NOT NULL,
  "owner" "OwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "parent_id" TEXT,
  "name" VARCHAR(50) NOT NULL,
  "finance_category_id" TEXT,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_categories_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_categories_owner_owner_id_idx" ON "stock_categories"("owner", "owner_id");
CREATE UNIQUE INDEX "stock_categories_name_key" ON "stock_categories"("owner", "owner_id", COALESCE("parent_id", ''), lower("name"));
ALTER TABLE "stock_categories" ADD CONSTRAINT "stock_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "stock_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_categories" ADD CONSTRAINT "stock_categories_finance_category_id_fkey" FOREIGN KEY ("finance_category_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "stock_locations" (
  "id" TEXT NOT NULL,
  "owner" "OwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_locations_owner_owner_id_idx" ON "stock_locations"("owner", "owner_id");
CREATE UNIQUE INDEX "stock_locations_name_key" ON "stock_locations"("owner", "owner_id", lower("name"));

-- Item columns
ALTER TABLE "stock_items"
  ADD COLUMN "category_id" TEXT,
  ADD COLUMN "location_id" TEXT,
  ADD COLUMN "min_quantity" DECIMAL(14, 3),
  ADD COLUMN "ideal_quantity" DECIMAL(14, 3),
  ADD COLUMN "opened_shelf_life_days" INTEGER,
  ADD COLUMN "warn_days_closed" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "warn_days_opened" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "stock_only" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "name_embedding" vector(1024);

-- Lots and movements
CREATE TABLE "stock_lots" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "quantity" DECIMAL(14, 3) NOT NULL,
  "expiration_date" DATE,
  "purchase_date" DATE,
  "opened_at" DATE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_lots_quantity_check" CHECK ("quantity" >= 0)
);
CREATE INDEX "stock_lots_item_id_idx" ON "stock_lots"("item_id");
CREATE INDEX "stock_lots_item_positive_idx" ON "stock_lots"("item_id") WHERE "quantity" > 0;
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "lot_id" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "reason" "StockMovementReason",
  "quantity" DECIMAL(14, 3) NOT NULL,
  "note" VARCHAR(200),
  "user_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_movements_item_id_created_at_id_idx" ON "stock_movements"("item_id", "created_at" DESC, "id" DESC);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data move: one lot (and one INITIAL movement) per item with quantity > 0. gram/milliliter become kg/L (÷ 1000).
INSERT INTO "stock_lots" ("id", "item_id", "quantity", "expiration_date", "purchase_date", "opened_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  "id",
  CASE WHEN "unit"::text IN ('gram', 'milliliter') THEN "quantity"::numeric / 1000 ELSE "quantity"::numeric END,
  ("expiration_date" AT TIME ZONE 'UTC')::date,
  ("purchase_date" AT TIME ZONE 'UTC')::date,
  ("opening_date" AT TIME ZONE 'UTC')::date,
  CURRENT_TIMESTAMP
FROM "stock_items"
WHERE "quantity" > 0;

INSERT INTO "stock_movements" ("id", "item_id", "lot_id", "type", "quantity", "user_id")
SELECT
  gen_random_uuid()::text,
  lot."item_id",
  lot."id",
  'INITIAL',
  lot."quantity",
  (
    SELECT u."id" FROM "User" u
    WHERE u."id" = CASE
      WHEN item."owner" = 'USER' THEN item."owner_id"
      ELSE (SELECT f."owner_id" FROM "families" f WHERE f."id" = item."owner_id")
    END
  )
FROM "stock_lots" lot
JOIN "stock_items" item ON item."id" = lot."item_id";

-- Units: recreate the enum without gram/milliliter.
ALTER TYPE "StockUnit" RENAME TO "StockUnit_old";
CREATE TYPE "StockUnit" AS ENUM ('unit', 'kilogram', 'liter');
ALTER TABLE "stock_items" ALTER COLUMN "unit" TYPE "StockUnit" USING (
  CASE "unit"::text WHEN 'gram' THEN 'kilogram' WHEN 'milliliter' THEN 'liter' ELSE "unit"::text END
)::"StockUnit";
DROP TYPE "StockUnit_old";

DO $$
BEGIN
  IF (SELECT COALESCE(SUM("quantity"), 0) FROM "stock_items" WHERE "unit"::text = 'unit')
     <> (SELECT COALESCE(SUM(lot."quantity"), 0) FROM "stock_lots" lot JOIN "stock_items" i ON i."id" = lot."item_id" WHERE i."unit"::text = 'unit') THEN
    RAISE EXCEPTION 'spec 116: unit quantities changed during the lot migration';
  END IF;
END $$;

ALTER TABLE "stock_items"
  DROP COLUMN "quantity",
  DROP COLUMN "purchase_date",
  DROP COLUMN "opening_date",
  DROP COLUMN "expiration_date";

ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "stock_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_min_quantity_check" CHECK ("min_quantity" IS NULL OR "min_quantity" >= 0);
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_ideal_quantity_check" CHECK ("ideal_quantity" IS NULL OR "min_quantity" IS NULL OR "ideal_quantity" > "min_quantity");
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_stock_only_check" CHECK (NOT "stock_only" OR ("min_quantity" IS NULL AND "ideal_quantity" IS NULL));
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_shelf_life_check" CHECK ("opened_shelf_life_days" IS NULL OR "opened_shelf_life_days" BETWEEN 1 AND 3650);
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_warn_days_check" CHECK ("warn_days_closed" BETWEEN 0 AND 365 AND "warn_days_opened" BETWEEN 0 AND 365);

CREATE INDEX "stock_items_owner_owner_id_category_id_idx" ON "stock_items"("owner", "owner_id", "category_id");
CREATE INDEX "stock_items_owner_owner_id_location_id_idx" ON "stock_items"("owner", "owner_id", "location_id");
CREATE INDEX "stock_items_name_trgm_idx" ON "stock_items" USING gin (
  (immutable_unaccent(lower("description" || ' ' || coalesce("brand", '')))) gin_trgm_ops
);
CREATE INDEX "stock_items_name_embedding_idx" ON "stock_items" USING hnsw ("name_embedding" vector_cosine_ops);
