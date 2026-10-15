-- CreateEnum
CREATE TYPE "SystemCategoryKey" AS ENUM ('BALANCE_ADJUSTMENT');

-- AlterTable: the typed balance becomes the initial balance; the ledger is initial + all transactions.
ALTER TABLE "financial_accounts"
  ADD COLUMN "initial_balance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ledger_balance" INTEGER NOT NULL DEFAULT 0;

UPDATE "financial_accounts" SET "initial_balance" = "balance";

UPDATE "financial_accounts" AS a
SET "ledger_balance" = a."initial_balance" + COALESCE((
  SELECT SUM(CASE WHEN t."type" = 'INCOME' THEN t."value" ELSE -t."value" END)
  FROM "financial_transactions" AS t
  WHERE t."account_id" = a."id"
), 0);

ALTER TABLE "financial_accounts" DROP COLUMN "balance";

-- AlterTable: system categories are owner-less rows with a unique key.
ALTER TABLE "financial_categories"
  ALTER COLUMN "owner" DROP NOT NULL,
  ALTER COLUMN "owner_id" DROP NOT NULL,
  ALTER COLUMN "type" DROP NOT NULL,
  ADD COLUMN "system_key" "SystemCategoryKey",
  ADD COLUMN "exclude_from_totals" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "financial_categories_system_key_key" ON "financial_categories"("system_key");

-- User categories are fully populated; system categories have no owner, no type and no parent.
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_system_shape_check" CHECK (
  ("system_key" IS NULL AND "owner" IS NOT NULL AND "owner_id" IS NOT NULL AND "type" IS NOT NULL)
  OR ("system_key" IS NOT NULL AND "owner" IS NULL AND "owner_id" IS NULL AND "parent_id" IS NULL)
);

-- Seed: the fixed id is mirrored by SYSTEM_CATEGORY_IDS in the domain.
INSERT INTO "financial_categories"
  ("id", "name", "icon", "icon_color", "type", "parent_id", "depth_level", "owner", "owner_id", "system_key", "exclude_from_totals", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Balance adjustment', 'scale-balance', '#607D8B', NULL, NULL, 0, NULL, NULL, 'BALANCE_ADJUSTMENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- DropIndex / CreateIndex: balances read the future rows of an account by date.
DROP INDEX "financial_transactions_account_id_idx";
CREATE INDEX "financial_transactions_account_id_date_idx" ON "financial_transactions"("account_id", "date");
