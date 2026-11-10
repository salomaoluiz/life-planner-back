-- Spec 104: automatic quotes, daily closes, FX rates and the exchange rate of USD operations.
CREATE TYPE "QuoteMarket" AS ENUM ('B3', 'US');
CREATE TYPE "QuoteSource" AS ENUM ('BRAPI', 'FINNHUB');

CREATE TABLE "investment_quotes" (
  "id" TEXT NOT NULL,
  "market" "QuoteMarket" NOT NULL,
  "ticker" VARCHAR(20) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "price" DECIMAL(20,8) NOT NULL,
  "previous_close" DECIMAL(20,8),
  "change_percent" DECIMAL(9,4),
  "day_high" DECIMAL(20,8),
  "day_low" DECIMAL(20,8),
  "quoted_at" TIMESTAMPTZ(6) NOT NULL,
  "fetched_at" TIMESTAMPTZ(6) NOT NULL,
  "source" "QuoteSource" NOT NULL,
  "last_error_at" TIMESTAMPTZ(6),
  "missing_days" INTEGER NOT NULL DEFAULT 0,
  "unavailable" BOOLEAN NOT NULL DEFAULT false,
  "name" TEXT,
  "logo_url" TEXT,
  CONSTRAINT "investment_quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "investment_quotes_price_positive" CHECK ("price" > 0)
);
CREATE UNIQUE INDEX "investment_quotes_market_ticker_key" ON "investment_quotes"("market", "ticker");

CREATE TABLE "investment_price_history" (
  "id" TEXT NOT NULL,
  "market" "QuoteMarket" NOT NULL,
  "ticker" VARCHAR(20) NOT NULL,
  "date" DATE NOT NULL,
  "close" DECIMAL(20,8) NOT NULL,
  "source" "QuoteSource" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "investment_price_history_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "investment_price_history_market_ticker_date_key" ON "investment_price_history"("market", "ticker", "date");

CREATE TABLE "fx_rates" (
  "id" TEXT NOT NULL,
  "pair" TEXT NOT NULL,
  "rate" DECIMAL(12,6) NOT NULL,
  "quoted_at" TIMESTAMPTZ(6) NOT NULL,
  "source" TEXT NOT NULL,
  CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fx_rates_pair_key" ON "fx_rates"("pair");

CREATE TABLE "fx_rate_history" (
  "id" TEXT NOT NULL,
  "pair" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "rate" DECIMAL(12,6) NOT NULL,
  "source" TEXT NOT NULL,
  CONSTRAINT "fx_rate_history_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fx_rate_history_pair_date_key" ON "fx_rate_history"("pair", "date");

ALTER TABLE "investment_operations" ADD COLUMN "fx_rate" DECIMAL(12,6);
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_fx_rate_positive" CHECK ("fx_rate" IS NULL OR "fx_rate" > 0);
