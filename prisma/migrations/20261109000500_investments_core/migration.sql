-- Spec 102: investments core.
CREATE TYPE "InvestmentAssetClass" AS ENUM ('BR_STOCK', 'BR_REIT', 'FOREIGN_STOCK', 'FIXED_INCOME', 'PRIVATE');
CREATE TYPE "InvestmentAssetStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "InvestmentOperationType" AS ENUM ('BUY', 'SELL');
CREATE TYPE "InvestmentFeeKind" AS ENUM ('BROKERAGE', 'EXCHANGE_FEES', 'FX_IOF', 'OTHER');
CREATE TYPE "InvestmentValuationSource" AS ENUM ('MANUAL');

CREATE TABLE "investment_assets" (
  "id" TEXT NOT NULL,
  "asset_class" "InvestmentAssetClass" NOT NULL,
  "ticker" VARCHAR(20),
  "name" VARCHAR(100) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "InvestmentAssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "archived_at" TIMESTAMPTZ(6),
  "owner" "OwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "investment_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "investment_assets_owner_owner_id_idx" ON "investment_assets"("owner", "owner_id");
CREATE UNIQUE INDEX "investment_assets_owner_ticker_key" ON "investment_assets"("owner", "owner_id", "ticker") WHERE "ticker" IS NOT NULL;

CREATE TABLE "investment_operations" (
  "id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "type" "InvestmentOperationType" NOT NULL,
  "date" DATE NOT NULL,
  "quantity" DECIMAL(18,8) NOT NULL,
  "unit_price" DECIMAL(20,8) NOT NULL,
  "gross" INTEGER NOT NULL,
  "fees_total" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "generate_transaction" BOOLEAN NOT NULL,
  "account_id" TEXT,
  "transaction_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "investment_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "investment_operations_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "investment_operations_unit_price_check" CHECK ("unit_price" > 0),
  CONSTRAINT "investment_operations_total_check" CHECK ("total" >= 0),
  CONSTRAINT "investment_operations_account_check" CHECK (NOT "generate_transaction" OR "account_id" IS NOT NULL)
);
CREATE UNIQUE INDEX "investment_operations_transaction_id_key" ON "investment_operations"("transaction_id");
CREATE INDEX "investment_operations_asset_id_date_created_at_id_idx" ON "investment_operations"("asset_id", "date", "created_at", "id");
CREATE INDEX "investment_operations_account_id_idx" ON "investment_operations"("account_id");
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "investment_operation_fees" (
  "id" TEXT NOT NULL,
  "operation_id" TEXT NOT NULL,
  "kind" "InvestmentFeeKind" NOT NULL,
  "amount" INTEGER NOT NULL,
  "description" VARCHAR(60),
  CONSTRAINT "investment_operation_fees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "investment_operation_fees_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "investment_operation_fees_other_check" CHECK ("kind" <> 'OTHER' OR "description" IS NOT NULL)
);
CREATE INDEX "investment_operation_fees_operation_id_idx" ON "investment_operation_fees"("operation_id");
ALTER TABLE "investment_operation_fees" ADD CONSTRAINT "investment_operation_fees_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "investment_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "investment_valuations" (
  "id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "unit_price" DECIMAL(20,8) NOT NULL,
  "source" "InvestmentValuationSource" NOT NULL DEFAULT 'MANUAL',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "investment_valuations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "investment_valuations_unit_price_check" CHECK ("unit_price" > 0)
);
CREATE UNIQUE INDEX "investment_valuations_asset_id_date_key" ON "investment_valuations"("asset_id", "date");
ALTER TABLE "investment_valuations" ADD CONSTRAINT "investment_valuations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seeds: the fixed ids are mirrored by SYSTEM_CATEGORY_IDS in the domain.
INSERT INTO "financial_categories"
  ("id", "name", "icon", "icon_color", "type", "parent_id", "depth_level", "owner", "owner_id", "system_key", "exclude_from_totals", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000009', 'Investment contribution', 'chart-line', '#5A6273', 'EXPENSE', NULL, 0, NULL, NULL, 'INVESTMENT_CONTRIBUTION', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-00000000000a', 'Investment redemption', 'cash-refund', '#5A6273', 'INCOME', NULL, 0, NULL, NULL, 'INVESTMENT_REDEMPTION', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
