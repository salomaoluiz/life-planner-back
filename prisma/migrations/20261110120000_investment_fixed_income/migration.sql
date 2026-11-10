-- Spec 105: fixed income calculated from the rate.
ALTER TYPE "InvestmentFeeKind" ADD VALUE 'INCOME_TAX';
ALTER TYPE "InvestmentFeeKind" ADD VALUE 'IOF';

CREATE TYPE "InvestmentFixedIncomeProduct" AS ENUM ('CDB', 'LCI', 'LCA', 'CRI', 'CRA', 'DEBENTURE', 'INCENTIVIZED_DEBENTURE', 'TREASURY', 'OTHER');
CREATE TYPE "InvestmentFixedIncomeLiquidity" AS ENUM ('DAILY', 'AT_MATURITY', 'GRACE_PERIOD');
CREATE TYPE "InvestmentFixedIncomeRateMode" AS ENUM ('PREFIXED', 'CDI_PERCENT', 'IPCA_PLUS');
CREATE TYPE "InvestmentFixedIncomeRedemptionKind" AS ENUM ('PARTIAL', 'TOTAL');

ALTER TABLE "investment_operations" ADD COLUMN "redemption_kind" "InvestmentFixedIncomeRedemptionKind",
ADD COLUMN "net_amount" INTEGER;

CREATE TABLE "investment_fixed_income_terms" (
    "asset_id" TEXT NOT NULL,
    "product" "InvestmentFixedIncomeProduct" NOT NULL,
    "tax_exempt" BOOLEAN NOT NULL,
    "maturity_date" DATE NOT NULL,
    "liquidity" "InvestmentFixedIncomeLiquidity" NOT NULL,
    "liquidity_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "investment_fixed_income_terms_pkey" PRIMARY KEY ("asset_id"),
    CONSTRAINT "investment_fixed_income_terms_liquidity_date_check" CHECK (
      ("liquidity" = 'GRACE_PERIOD' AND "liquidity_date" IS NOT NULL)
      OR ("liquidity" <> 'GRACE_PERIOD' AND "liquidity_date" IS NULL)
    )
);

CREATE TABLE "investment_fixed_income_rates" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "mode" "InvestmentFixedIncomeRateMode" NOT NULL,
    "annual_rate" DECIMAL(9,4),
    "cdi_percent" DECIMAL(9,4),
    "spread" DECIMAL(9,4),
    "index_rate" DECIMAL(9,4),
    "effective_rate" DECIMAL(12,6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "investment_fixed_income_rates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "investment_fixed_income_rates_mode_check" CHECK (
      ("mode" = 'PREFIXED' AND "annual_rate" IS NOT NULL AND "cdi_percent" IS NULL AND "spread" IS NULL AND "index_rate" IS NULL)
      OR ("mode" = 'CDI_PERCENT' AND "cdi_percent" IS NOT NULL AND "index_rate" IS NOT NULL AND "annual_rate" IS NULL AND "spread" IS NULL)
      OR ("mode" = 'IPCA_PLUS' AND "spread" IS NOT NULL AND "index_rate" IS NOT NULL AND "annual_rate" IS NULL AND "cdi_percent" IS NULL)
    )
);

CREATE TABLE "investment_fixed_income_adjustments" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "gross_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "investment_fixed_income_adjustments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "investment_fixed_income_adjustments_gross_check" CHECK ("gross_amount" > 0)
);

CREATE INDEX "investment_fixed_income_terms_maturity_date_idx" ON "investment_fixed_income_terms"("maturity_date");
CREATE UNIQUE INDEX "investment_fixed_income_rates_asset_id_start_date_key" ON "investment_fixed_income_rates"("asset_id", "start_date");
CREATE UNIQUE INDEX "investment_fixed_income_adjustments_asset_id_date_key" ON "investment_fixed_income_adjustments"("asset_id", "date");

ALTER TABLE "investment_fixed_income_terms" ADD CONSTRAINT "investment_fixed_income_terms_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investment_fixed_income_rates" ADD CONSTRAINT "investment_fixed_income_rates_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investment_fixed_income_adjustments" ADD CONSTRAINT "investment_fixed_income_adjustments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
