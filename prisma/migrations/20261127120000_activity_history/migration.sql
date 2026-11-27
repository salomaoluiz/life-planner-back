-- Spec 127: activity history (entries and batch items). Additive only.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "ActivityModule" AS ENUM ('FINANCE', 'INVESTMENT');
CREATE TYPE "ActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
CREATE TYPE "ActivityEntityType" AS ENUM ('TRANSACTION', 'TRANSFER', 'SPLIT', 'RECURRENCE', 'INSTALLMENT_PLAN', 'INSTALLMENT_PREPAYMENT', 'CARD_REFUND', 'CARD_EARLY_PAYMENT', 'INVOICE_PAYMENT', 'BALANCE_ADJUSTMENT', 'ACCOUNT', 'CREDIT_CARD', 'CATEGORY', 'TAG', 'TRANSACTION_IMPORT', 'STOCK_PURCHASE_POSTING', 'ASSET', 'OPERATION', 'VALUATION', 'FIXED_INCOME_TERMS', 'INCOME', 'INCOME_SERIES', 'CORPORATE_EVENT', 'CONVERSION');

CREATE TABLE "activity_entries" (
  "id" TEXT NOT NULL,
  "owner" "OwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "modules" "ActivityModule"[],
  "action" "ActivityAction" NOT NULL,
  "batch" BOOLEAN NOT NULL DEFAULT false,
  "entity_type" "ActivityEntityType" NOT NULL,
  "entity_id" TEXT,
  "actor_id" TEXT,
  "actor_name" TEXT NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "summary" JSONB NOT NULL,
  "changes" JSONB,
  "search_text" TEXT NOT NULL,
  CONSTRAINT "activity_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_entries_modules_check" CHECK (cardinality("modules") > 0)
);
CREATE INDEX "activity_entries_owner_idx" ON "activity_entries"("owner", "owner_id", "occurred_at" DESC, "id");
CREATE INDEX "activity_entries_occurred_at_idx" ON "activity_entries"("occurred_at");
CREATE INDEX "activity_entries_modules_idx" ON "activity_entries" USING GIN ("modules");
CREATE INDEX "activity_entries_search_text_trgm_idx" ON "activity_entries" USING GIN ("search_text" gin_trgm_ops);
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "activity_entry_items" (
  "id" TEXT NOT NULL,
  "entry_id" TEXT NOT NULL,
  "action" "ActivityAction" NOT NULL,
  "entity_type" "ActivityEntityType" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount_cents" BIGINT,
  "currency" TEXT,
  "booking_date" DATE,
  "source_name" TEXT,
  CONSTRAINT "activity_entry_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "activity_entry_items_entry_idx" ON "activity_entry_items"("entry_id", "booking_date" DESC, "id");
ALTER TABLE "activity_entry_items" ADD CONSTRAINT "activity_entry_items_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "activity_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
