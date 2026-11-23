-- Spec 120: markets, purchases (shopping mode and closing), purchase events, price history, read-only finance link.
CREATE TYPE "StockPurchaseStatus" AS ENUM ('OPEN', 'ENDED', 'CLOSED', 'DISCARDED');
CREATE TYPE "PurchasePriceInput" AS ENUM ('UNIT', 'LINE');
CREATE TYPE "PurchaseRowState" AS ENUM ('IN_CART', 'NOT_FOUND');

CREATE TABLE "stock_markets" (
  "id" TEXT NOT NULL,
  "owner" "OwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "name" VARCHAR(60) NOT NULL,
  "neighborhood" VARCHAR(60),
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_markets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_markets_owner_owner_id_idx" ON "stock_markets"("owner", "owner_id");
CREATE UNIQUE INDEX "stock_markets_name_key" ON "stock_markets"("owner", "owner_id", lower("name")) WHERE "status" = 'ACTIVE';

ALTER TABLE "stock_shopping_lists"
  ADD COLUMN "default_market_id" TEXT,
  ADD COLUMN "default_finance_category_id" TEXT;
ALTER TABLE "stock_shopping_lists" ADD CONSTRAINT "stock_shopping_lists_default_market_id_fkey" FOREIGN KEY ("default_market_id") REFERENCES "stock_markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "stock_purchases" (
  "id" UUID NOT NULL,
  "list_id" TEXT NOT NULL,
  "owner" "OwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "status" "StockPurchaseStatus" NOT NULL DEFAULT 'OPEN',
  "started_by" TEXT,
  "closed_by" TEXT,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),
  "closed_at" TIMESTAMPTZ(6),
  "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closing_by" TEXT,
  "closing_at" TIMESTAMPTZ(6),
  "purchase_date" DATE NOT NULL,
  "receipt_total_cents" INTEGER,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "account_id" TEXT,
  "credit_card_id" TEXT,
  "invoice_month" CHAR(7),
  "split_id" TEXT,
  "transaction_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_purchases_receipt_check" CHECK ("receipt_total_cents" IS NULL OR "receipt_total_cents" > 0),
  CONSTRAINT "stock_purchases_source_check" CHECK ("account_id" IS NULL OR "credit_card_id" IS NULL),
  CONSTRAINT "stock_purchases_closed_check" CHECK ("status" <> 'CLOSED' OR ("receipt_total_cents" IS NOT NULL AND ("account_id" IS NOT NULL OR "credit_card_id" IS NOT NULL)))
);
CREATE INDEX "stock_purchases_list_id_status_idx" ON "stock_purchases"("list_id", "status");
CREATE INDEX "stock_purchases_owner_status_activity_idx" ON "stock_purchases"("owner", "owner_id", "status", "last_activity_at");
CREATE INDEX "stock_purchases_list_closed_idx" ON "stock_purchases"("list_id", "closed_at" DESC, "id" DESC) WHERE "status" = 'CLOSED';
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "stock_shopping_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "stock_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "stock_purchase_rows" (
  "id" UUID NOT NULL,
  "purchase_id" UUID NOT NULL,
  "list_row_id" TEXT,
  "item_id" TEXT,
  "description" VARCHAR(100),
  "unit" "StockUnit",
  "quantity" DECIMAL(14, 3),
  "unit_price_cents" INTEGER,
  "line_total_cents" INTEGER,
  "price_input" "PurchasePriceInput",
  "unknown_price" BOOLEAN NOT NULL DEFAULT false,
  "expiration_date" DATE,
  "state" "PurchaseRowState" NOT NULL DEFAULT 'IN_CART',
  "entry_movement_id" TEXT,
  "checked_by" TEXT,
  "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_purchase_rows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_purchase_rows_quantity_check" CHECK ("quantity" IS NULL OR "quantity" > 0),
  CONSTRAINT "stock_purchase_rows_price_check" CHECK (("unit_price_cents" IS NULL OR "unit_price_cents" > 0) AND ("line_total_cents" IS NULL OR "line_total_cents" > 0)),
  CONSTRAINT "stock_purchase_rows_text_check" CHECK ("item_id" IS NOT NULL OR "list_row_id" IS NOT NULL OR ("description" IS NOT NULL AND "unit" IS NOT NULL))
);
CREATE INDEX "stock_purchase_rows_purchase_id_idx" ON "stock_purchase_rows"("purchase_id");
CREATE INDEX "stock_purchase_rows_list_row_id_idx" ON "stock_purchase_rows"("list_row_id");
CREATE UNIQUE INDEX "stock_purchase_rows_list_row_key" ON "stock_purchase_rows"("purchase_id", "list_row_id") WHERE "list_row_id" IS NOT NULL;
CREATE UNIQUE INDEX "stock_purchase_rows_item_key" ON "stock_purchase_rows"("purchase_id", "item_id") WHERE "item_id" IS NOT NULL;
ALTER TABLE "stock_purchase_rows" ADD CONSTRAINT "stock_purchase_rows_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "stock_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_purchase_rows" ADD CONSTRAINT "stock_purchase_rows_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_purchase_rows" ADD CONSTRAINT "stock_purchase_rows_entry_movement_id_fkey" FOREIGN KEY ("entry_movement_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_purchase_rows" ADD CONSTRAINT "stock_purchase_rows_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "stock_purchase_events" (
  "id" BIGSERIAL NOT NULL,
  "list_id" TEXT NOT NULL,
  "purchase_id" UUID NOT NULL,
  "type" VARCHAR(40) NOT NULL,
  "payload" JSONB NOT NULL,
  "client_id" UUID,
  "user_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_purchase_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_purchase_events_client_id_key" ON "stock_purchase_events"("client_id");
CREATE INDEX "stock_purchase_events_list_id_id_idx" ON "stock_purchase_events"("list_id", "id");

CREATE TABLE "stock_price_history" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "purchase_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_price_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_price_history_price_check" CHECK ("unit_price_cents" > 0)
);
CREATE INDEX "stock_price_history_item_market_date_idx" ON "stock_price_history"("item_id", "market_id", "date" DESC);
CREATE INDEX "stock_price_history_item_date_idx" ON "stock_price_history"("item_id", "date" DESC);
ALTER TABLE "stock_price_history" ADD CONSTRAINT "stock_price_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_price_history" ADD CONSTRAINT "stock_price_history_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "stock_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_price_history" ADD CONSTRAINT "stock_price_history_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "stock_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_splits" ADD COLUMN "stock_purchase_id" UUID;
ALTER TABLE "financial_splits" ADD CONSTRAINT "financial_splits_stock_purchase_id_fkey" FOREIGN KEY ("stock_purchase_id") REFERENCES "stock_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "financial_splits_stock_purchase_id_key" ON "financial_splits"("stock_purchase_id");
ALTER TABLE "financial_transactions" ADD COLUMN "stock_purchase_id" UUID;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_stock_purchase_id_fkey" FOREIGN KEY ("stock_purchase_id") REFERENCES "stock_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "financial_transactions_stock_purchase_id_idx" ON "financial_transactions"("stock_purchase_id") WHERE "stock_purchase_id" IS NOT NULL;
