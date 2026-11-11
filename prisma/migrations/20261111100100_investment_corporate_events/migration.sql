-- Spec 108: corporate events (split, reverse split, bonus), fraction sales and event suggestions.
CREATE TYPE "InvestmentCorporateEventType" AS ENUM ('SPLIT', 'REVERSE_SPLIT', 'BONUS');

ALTER TABLE "investment_operations"
  ALTER COLUMN "quantity" DROP NOT NULL,
  ALTER COLUMN "unit_price" DROP NOT NULL,
  ALTER COLUMN "gross" DROP NOT NULL,
  ALTER COLUMN "fees_total" DROP NOT NULL,
  ALTER COLUMN "total" DROP NOT NULL,
  ADD COLUMN "ratio_from" DECIMAL(18,8),
  ADD COLUMN "ratio_to" DECIMAL(18,8),
  ADD COLUMN "bonus_percent" DECIMAL(12,8),
  ADD COLUMN "bonus_unit_cost" DECIMAL(20,8),
  ADD COLUMN "fraction_of_operation_id" TEXT,
  ADD COLUMN "event_suggestion_id" TEXT;

CREATE TABLE "investment_corporate_events" (
  "id" TEXT NOT NULL,
  "market" "QuoteMarket" NOT NULL,
  "ticker" VARCHAR(20) NOT NULL,
  "event_key" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "type" "InvestmentCorporateEventType" NOT NULL,
  "record_date" DATE NOT NULL,
  "ratio_from" DECIMAL(18,8),
  "ratio_to" DECIMAL(18,8),
  "bonus_percent" DECIMAL(12,8),
  "bonus_unit_cost" DECIMAL(20,8),
  "currency" VARCHAR(3) NOT NULL,
  "fetched_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "investment_corporate_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "investment_corporate_events_event_key_key" ON "investment_corporate_events"("event_key");
CREATE INDEX "investment_corporate_events_market_ticker_record_date_idx" ON "investment_corporate_events"("market", "ticker", "record_date");

CREATE TABLE "investment_event_suggestions" (
  "id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "quantity" DECIMAL(18,8) NOT NULL,
  "status" "InvestmentSuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "decided_by" TEXT,
  "decided_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "investment_event_suggestions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "investment_event_suggestions_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "investment_event_suggestions_asset_id_event_id_key" ON "investment_event_suggestions"("asset_id", "event_id");
CREATE INDEX "investment_event_suggestions_asset_id_status_idx" ON "investment_event_suggestions"("asset_id", "status");
ALTER TABLE "investment_event_suggestions" ADD CONSTRAINT "investment_event_suggestions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investment_event_suggestions" ADD CONSTRAINT "investment_event_suggestions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "investment_corporate_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "investment_operations_fraction_of_operation_id_key" ON "investment_operations"("fraction_of_operation_id");
CREATE UNIQUE INDEX "investment_operations_event_suggestion_id_key" ON "investment_operations"("event_suggestion_id");
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_fraction_of_operation_id_fkey" FOREIGN KEY ("fraction_of_operation_id") REFERENCES "investment_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_event_suggestion_id_fkey" FOREIGN KEY ("event_suggestion_id") REFERENCES "investment_event_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BUY/SELL carry the money fields, events carry their ratio or bonus fields (existing BUY/SELL rows satisfy this).
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_kind_check" CHECK (
  (
    "type" IN ('BUY', 'SELL')
    AND "quantity" IS NOT NULL AND "unit_price" IS NOT NULL AND "gross" IS NOT NULL
    AND "fees_total" IS NOT NULL AND "total" IS NOT NULL
    AND "ratio_from" IS NULL AND "ratio_to" IS NULL AND "bonus_percent" IS NULL AND "bonus_unit_cost" IS NULL
    AND "event_suggestion_id" IS NULL
  ) OR (
    "type" IN ('SPLIT', 'REVERSE_SPLIT', 'BONUS')
    AND "quantity" IS NULL AND "unit_price" IS NULL AND "gross" IS NULL AND "fees_total" IS NULL AND "total" IS NULL
    AND "generate_transaction" = false AND "account_id" IS NULL AND "fraction_of_operation_id" IS NULL
  )
);
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_split_check" CHECK (
  "type" NOT IN ('SPLIT', 'REVERSE_SPLIT') OR (
    "ratio_from" > 0 AND "ratio_to" > 0 AND "bonus_percent" IS NULL AND "bonus_unit_cost" IS NULL
    AND (("type" = 'SPLIT' AND "ratio_to" > "ratio_from") OR ("type" = 'REVERSE_SPLIT' AND "ratio_to" < "ratio_from"))
  )
);
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_bonus_check" CHECK (
  "type" <> 'BONUS' OR (
    "bonus_percent" > 0 AND "bonus_percent" <= 1000 AND ("bonus_unit_cost" IS NULL OR "bonus_unit_cost" >= 0)
    AND "ratio_from" IS NULL AND "ratio_to" IS NULL
  )
);
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_fraction_check" CHECK (
  "fraction_of_operation_id" IS NULL OR "type" = 'SELL'
);

-- Spec 108 section 13: a fraction the broker pays nothing for is written off with a zero unit price.
ALTER TABLE "investment_operations" DROP CONSTRAINT "investment_operations_unit_price_check";
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_unit_price_check" CHECK ("unit_price" > 0 OR "fraction_of_operation_id" IS NOT NULL);
