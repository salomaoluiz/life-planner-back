-- Spec 107: investment income, announced events and suggestions; generic external lock on finance rows.
CREATE TYPE "TransactionExternalLock" AS ENUM ('INVESTMENT');
CREATE TYPE "InvestmentIncomeType" AS ENUM ('DIVIDEND', 'JCP', 'YIELD', 'INTEREST', 'OTHER');
CREATE TYPE "InvestmentSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISMISSED');

ALTER TABLE "financial_transactions" ADD COLUMN "external_lock" "TransactionExternalLock";

CREATE TABLE "investment_income_events" (
  "id" TEXT NOT NULL,
  "market" "QuoteMarket" NOT NULL,
  "ticker" VARCHAR(20) NOT NULL,
  "event_key" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "type" "InvestmentIncomeType" NOT NULL,
  "ex_date" DATE NOT NULL,
  "payment_date" DATE,
  "amount_per_unit" DECIMAL(20,8) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "fetched_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "investment_income_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "investment_income_events_amount_check" CHECK ("amount_per_unit" > 0)
);
CREATE UNIQUE INDEX "investment_income_events_event_key_key" ON "investment_income_events"("event_key");
CREATE INDEX "investment_income_events_market_ticker_ex_date_idx" ON "investment_income_events"("market", "ticker", "ex_date");

CREATE TABLE "investment_income_suggestions" (
  "id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "quantity" DECIMAL(20,8) NOT NULL,
  "status" "InvestmentSuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "decided_by" TEXT,
  "decided_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "investment_income_suggestions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "investment_income_suggestions_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "investment_income_suggestions_asset_id_event_id_key" ON "investment_income_suggestions"("asset_id", "event_id");
CREATE INDEX "investment_income_suggestions_asset_id_status_idx" ON "investment_income_suggestions"("asset_id", "status");
ALTER TABLE "investment_income_suggestions" ADD CONSTRAINT "investment_income_suggestions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investment_income_suggestions" ADD CONSTRAINT "investment_income_suggestions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "investment_income_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "investment_incomes" (
  "id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "type" "InvestmentIncomeType" NOT NULL,
  "ex_date" DATE,
  "payment_date" DATE NOT NULL,
  "quantity" DECIMAL(20,8),
  "amount_per_unit" DECIMAL(20,8),
  "net_amount" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "transaction_id" TEXT,
  "suggestion_id" TEXT,
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "investment_incomes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "investment_incomes_quantity_check" CHECK ("quantity" IS NULL OR "quantity" > 0),
  CONSTRAINT "investment_incomes_amount_per_unit_check" CHECK ("amount_per_unit" IS NULL OR "amount_per_unit" > 0),
  CONSTRAINT "investment_incomes_net_amount_check" CHECK ("net_amount" > 0),
  CONSTRAINT "investment_incomes_notes_check" CHECK ("notes" IS NULL OR char_length("notes") <= 1000)
);
CREATE UNIQUE INDEX "investment_incomes_transaction_id_key" ON "investment_incomes"("transaction_id");
CREATE UNIQUE INDEX "investment_incomes_suggestion_id_key" ON "investment_incomes"("suggestion_id");
CREATE INDEX "investment_incomes_asset_id_payment_date_id_idx" ON "investment_incomes"("asset_id", "payment_date" DESC, "id" DESC);
CREATE INDEX "investment_incomes_asset_id_type_ex_date_idx" ON "investment_incomes"("asset_id", "type", "ex_date");
ALTER TABLE "investment_incomes" ADD CONSTRAINT "investment_incomes_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investment_incomes" ADD CONSTRAINT "investment_incomes_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "investment_incomes" ADD CONSTRAINT "investment_incomes_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "investment_income_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
