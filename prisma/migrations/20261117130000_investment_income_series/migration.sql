-- Spec 115: recurring investment income (series), stored income status and incomes without a finance row.
CREATE TYPE "InvestmentIncomeSeriesEndReason" AS ENUM ('END_DATE', 'POSITION_ZERO', 'MANUAL', 'SPLIT');

CREATE TABLE "investment_income_series" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "type" "InvestmentIncomeType" NOT NULL,
    "first_payment_date" DATE NOT NULL,
    "frequency_unit" "RecurrenceUnit" NOT NULL,
    "frequency_interval" INTEGER NOT NULL,
    "end_date" DATE,
    "ex_date_offset_days" INTEGER,
    "amount_per_unit" DECIMAL(20,8) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "with_finance" BOOLEAN NOT NULL,
    "account_id" TEXT,
    "category_id" TEXT,
    "notes" TEXT,
    "first_number" INTEGER NOT NULL DEFAULT 1,
    "last_generated_number" INTEGER NOT NULL DEFAULT 0,
    "ended_at" DATE,
    "end_reason" "InvestmentIncomeSeriesEndReason",
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "investment_income_series_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investment_income_series_asset_id_idx" ON "investment_income_series"("asset_id");
CREATE INDEX "investment_income_series_active_idx" ON "investment_income_series"("asset_id") WHERE "ended_at" IS NULL;

ALTER TABLE "investment_income_series" ADD CONSTRAINT "investment_income_series_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investment_income_series" ADD CONSTRAINT "investment_income_series_frequency_interval_check" CHECK (
  ("frequency_unit" = 'DAY' AND "frequency_interval" BETWEEN 1 AND 365)
  OR ("frequency_unit" = 'WEEK' AND "frequency_interval" BETWEEN 1 AND 52)
  OR ("frequency_unit" = 'MONTH' AND "frequency_interval" BETWEEN 1 AND 24)
  OR ("frequency_unit" = 'YEAR' AND "frequency_interval" BETWEEN 1 AND 10)
);
ALTER TABLE "investment_income_series" ADD CONSTRAINT "investment_income_series_offset_check"
  CHECK ("ex_date_offset_days" IS NULL OR "ex_date_offset_days" BETWEEN 0 AND 90);
ALTER TABLE "investment_income_series" ADD CONSTRAINT "investment_income_series_amount_check"
  CHECK ("amount_per_unit" > 0);
ALTER TABLE "investment_income_series" ADD CONSTRAINT "investment_income_series_end_date_check"
  CHECK ("end_date" IS NULL OR "end_date" >= "first_payment_date");
ALTER TABLE "investment_income_series" ADD CONSTRAINT "investment_income_series_finance_check" CHECK (
  ("with_finance" AND "account_id" IS NOT NULL AND "category_id" IS NOT NULL)
  OR (NOT "with_finance" AND "account_id" IS NULL AND "category_id" IS NULL)
);
ALTER TABLE "investment_income_series" ADD CONSTRAINT "investment_income_series_notes_check"
  CHECK ("notes" IS NULL OR char_length("notes") <= 1000);
ALTER TABLE "investment_income_series" ADD CONSTRAINT "investment_income_series_ended_check"
  CHECK (("ended_at" IS NULL) = ("end_reason" IS NULL));

ALTER TABLE "investment_incomes" ADD COLUMN "received" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "investment_incomes" ADD COLUMN "series_id" TEXT;
ALTER TABLE "investment_incomes" ADD COLUMN "occurrence_number" INTEGER;

-- FR 2: the status moves onto the income. A linked income takes the `paid` of its row; one whose row is gone is not received.
UPDATE "investment_incomes" i
SET "received" = COALESCE((SELECT t."paid" FROM "financial_transactions" t WHERE t."id" = i."transaction_id"), false);

ALTER TABLE "investment_incomes" ADD CONSTRAINT "investment_incomes_series_id_fkey"
  FOREIGN KEY ("series_id") REFERENCES "investment_income_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "investment_incomes_series_id_occurrence_number_key"
  ON "investment_incomes"("series_id", "occurrence_number");
ALTER TABLE "investment_incomes" ADD CONSTRAINT "investment_incomes_series_number_check"
  CHECK (("series_id" IS NULL) = ("occurrence_number" IS NULL));
