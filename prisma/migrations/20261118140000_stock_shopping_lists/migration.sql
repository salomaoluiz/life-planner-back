-- Spec 118: shopping lists, rows (smart + manual + text), restock dismissals, list per stock item.
CREATE TYPE "ShoppingListRowOrigin" AS ENUM ('AUTO', 'AUTO_EDITED', 'MANUAL');

CREATE TABLE "stock_shopping_lists" (
  "id" TEXT NOT NULL,
  "owner" "OwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_shopping_lists_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_shopping_lists_default_active_check" CHECK (NOT ("is_default" AND "status" = 'ARCHIVED'))
);
CREATE INDEX "stock_shopping_lists_owner_owner_id_idx" ON "stock_shopping_lists"("owner", "owner_id");
CREATE UNIQUE INDEX "stock_shopping_lists_name_key" ON "stock_shopping_lists"("owner", "owner_id", lower("name")) WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "stock_shopping_lists_default_key" ON "stock_shopping_lists"("owner", "owner_id") WHERE "is_default";

CREATE TABLE "stock_shopping_list_rows" (
  "id" TEXT NOT NULL,
  "list_id" TEXT NOT NULL,
  "item_id" TEXT,
  "description" VARCHAR(100),
  "unit" "StockUnit",
  "quantity" DECIMAL(14, 3) NOT NULL,
  "origin" "ShoppingListRowOrigin" NOT NULL,
  "estimated_unit_price_cents" INTEGER,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_shopping_list_rows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_shopping_list_rows_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "stock_shopping_list_rows_text_check" CHECK ("item_id" IS NOT NULL OR ("description" IS NOT NULL AND "unit" IS NOT NULL)),
  CONSTRAINT "stock_shopping_list_rows_origin_check" CHECK ("item_id" IS NOT NULL OR "origin" = 'MANUAL'),
  CONSTRAINT "stock_shopping_list_rows_price_check" CHECK ("estimated_unit_price_cents" IS NULL OR ("item_id" IS NULL AND "estimated_unit_price_cents" > 0 AND "estimated_unit_price_cents" <= 99999999))
);
CREATE INDEX "stock_shopping_list_rows_list_id_origin_idx" ON "stock_shopping_list_rows"("list_id", "origin");
CREATE INDEX "stock_shopping_list_rows_item_id_idx" ON "stock_shopping_list_rows"("item_id");
CREATE UNIQUE INDEX "stock_shopping_list_rows_list_item_key" ON "stock_shopping_list_rows"("list_id", "item_id") WHERE "item_id" IS NOT NULL;
ALTER TABLE "stock_shopping_list_rows" ADD CONSTRAINT "stock_shopping_list_rows_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "stock_shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_shopping_list_rows" ADD CONSTRAINT "stock_shopping_list_rows_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_shopping_list_rows" ADD CONSTRAINT "stock_shopping_list_rows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "stock_restock_dismissals" (
  "item_id" TEXT NOT NULL,
  "dismissed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissed_by" TEXT,
  CONSTRAINT "stock_restock_dismissals_pkey" PRIMARY KEY ("item_id")
);
ALTER TABLE "stock_restock_dismissals" ADD CONSTRAINT "stock_restock_dismissals_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_restock_dismissals" ADD CONSTRAINT "stock_restock_dismissals_dismissed_by_fkey" FOREIGN KEY ("dismissed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_items"
  ADD COLUMN "shopping_list_id" TEXT,
  ADD COLUMN "estimated_unit_price_cents" INTEGER;
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_shopping_list_id_fkey" FOREIGN KEY ("shopping_list_id") REFERENCES "stock_shopping_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_estimated_price_check" CHECK ("estimated_unit_price_cents" IS NULL OR ("estimated_unit_price_cents" > 0 AND "estimated_unit_price_cents" <= 99999999));
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_list_stock_only_check" CHECK (NOT ("stock_only" AND "shopping_list_id" IS NOT NULL));
