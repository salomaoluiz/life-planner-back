-- Spec 113: global market indexes (CDI, Selic, IPCA) from the Central Bank. No owner.
CREATE TYPE "MarketIndexSeries" AS ENUM ('CDI_DAILY', 'CDI_ANNUAL', 'SELIC_DAILY', 'SELIC_TARGET', 'IPCA_MONTHLY', 'IPCA_12M', 'IPCA_EXPECTED_12M');

CREATE TABLE "market_index_values" (
  "id" TEXT NOT NULL,
  "series" "MarketIndexSeries" NOT NULL,
  "date" DATE NOT NULL,
  "value" DECIMAL(14,8) NOT NULL,
  "source" VARCHAR(20) NOT NULL,
  "fetched_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "market_index_values_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "market_index_values_series_date_key" ON "market_index_values"("series", "date");

CREATE TABLE "market_index_fetches" (
  "series" "MarketIndexSeries" NOT NULL,
  "last_success_at" TIMESTAMPTZ(6),
  "last_attempt_at" TIMESTAMPTZ(6),
  "last_error" VARCHAR(30),
  CONSTRAINT "market_index_fetches_pkey" PRIMARY KEY ("series")
);

-- `index_rate` stays (nullable) for rollback but is no longer written or read: indexed rates follow the global series.
ALTER TABLE "investment_fixed_income_rates" DROP CONSTRAINT "investment_fixed_income_rates_mode_check";
ALTER TABLE "investment_fixed_income_rates" ADD CONSTRAINT "investment_fixed_income_rates_mode_check" CHECK (
  ("mode" = 'PREFIXED' AND "annual_rate" IS NOT NULL AND "cdi_percent" IS NULL AND "spread" IS NULL)
  OR ("mode" = 'CDI_PERCENT' AND "cdi_percent" IS NOT NULL AND "annual_rate" IS NULL AND "spread" IS NULL)
  OR ("mode" = 'IPCA_PLUS' AND "spread" IS NOT NULL AND "annual_rate" IS NULL AND "cdi_percent" IS NULL)
);
