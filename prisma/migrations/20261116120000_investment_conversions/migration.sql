-- Spec 112: one asset converted into another of the same class (merger or ticker change).
CREATE TABLE "investment_conversions" (
  "id" TEXT NOT NULL,
  "from_asset_id" TEXT NOT NULL,
  "to_asset_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "ratio_from" DECIMAL(18,8) NOT NULL,
  "ratio_to" DECIMAL(18,8) NOT NULL,
  "cash_amount" INTEGER,
  "cash_reference_unit_value" DECIMAL(20,8),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "investment_conversions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "investment_conversions_assets_check" CHECK ("to_asset_id" <> "from_asset_id"),
  CONSTRAINT "investment_conversions_ratio_check" CHECK ("ratio_from" > 0 AND "ratio_to" > 0),
  CONSTRAINT "investment_conversions_cash_check" CHECK (
    ("cash_amount" IS NULL AND "cash_reference_unit_value" IS NULL)
    OR ("cash_amount" > 0 AND "cash_reference_unit_value" > 0)
  )
);
CREATE UNIQUE INDEX "investment_conversions_from_asset_id_key" ON "investment_conversions"("from_asset_id");
CREATE INDEX "investment_conversions_to_asset_id_idx" ON "investment_conversions"("to_asset_id");
ALTER TABLE "investment_conversions" ADD CONSTRAINT "investment_conversions_from_asset_id_fkey" FOREIGN KEY ("from_asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investment_conversions" ADD CONSTRAINT "investment_conversions_to_asset_id_fkey" FOREIGN KEY ("to_asset_id") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investment_operations"
  ADD COLUMN "conversion_id" TEXT,
  ADD COLUMN "conversion_cost" INTEGER,
  ADD COLUMN "fraction_quantity" DECIMAL(18,8),
  ADD COLUMN "fraction_cost" INTEGER,
  ADD COLUMN "cash_cost" INTEGER;
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_conversion_id_fkey" FOREIGN KEY ("conversion_id") REFERENCES "investment_conversions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "investment_operations_conversion_id_type_key" ON "investment_operations"("conversion_id", "type");

-- `cash_cost` (CONVERSION_OUT with a cash part): the share of the cost the cash took, so the origin's realized result = gross - cash_cost.
-- Conversion rows carry the stored snapshot (quantity, conversion_cost, fraction); only a CONVERSION_OUT with a cash part
-- carries money fields (gross = total = the cash amount). Existing rows satisfy the check (conversion_id is null).
ALTER TABLE "investment_operations" DROP CONSTRAINT "investment_operations_kind_check";
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_kind_check" CHECK (
  (
    "type" IN ('BUY', 'SELL')
    AND "quantity" IS NOT NULL AND "unit_price" IS NOT NULL AND "gross" IS NOT NULL
    AND "fees_total" IS NOT NULL AND "total" IS NOT NULL
    AND "ratio_from" IS NULL AND "ratio_to" IS NULL AND "bonus_percent" IS NULL AND "bonus_unit_cost" IS NULL
    AND "event_suggestion_id" IS NULL
    AND "conversion_id" IS NULL AND "conversion_cost" IS NULL AND "fraction_quantity" IS NULL AND "fraction_cost" IS NULL
  ) OR (
    "type" IN ('SPLIT', 'REVERSE_SPLIT', 'BONUS')
    AND "quantity" IS NULL AND "unit_price" IS NULL AND "gross" IS NULL AND "fees_total" IS NULL AND "total" IS NULL
    AND "generate_transaction" = false AND "account_id" IS NULL AND "fraction_of_operation_id" IS NULL
    AND "conversion_id" IS NULL AND "conversion_cost" IS NULL AND "fraction_quantity" IS NULL AND "fraction_cost" IS NULL
  ) OR (
    "type" = 'CONVERSION_OUT'
    AND "conversion_id" IS NOT NULL AND "quantity" IS NOT NULL AND "conversion_cost" IS NOT NULL
    AND "fraction_quantity" IS NULL AND "fraction_cost" IS NULL AND "unit_price" IS NULL
    AND "fraction_of_operation_id" IS NULL AND "event_suggestion_id" IS NULL
    AND "ratio_from" IS NULL AND "ratio_to" IS NULL AND "bonus_percent" IS NULL AND "bonus_unit_cost" IS NULL
    AND (
      ("gross" IS NULL AND "fees_total" IS NULL AND "total" IS NULL AND "cash_cost" IS NULL AND "generate_transaction" = false AND "account_id" IS NULL)
      OR ("gross" > 0 AND "fees_total" = 0 AND "total" = "gross" AND "cash_cost" IS NOT NULL)
    )
  ) OR (
    "type" = 'CONVERSION_IN'
    AND "conversion_id" IS NOT NULL AND "quantity" IS NOT NULL AND "conversion_cost" IS NOT NULL
    AND "fraction_quantity" IS NOT NULL AND "fraction_cost" IS NOT NULL AND "unit_price" IS NULL
    AND "gross" IS NULL AND "fees_total" IS NULL AND "total" IS NULL
    AND "generate_transaction" = false AND "account_id" IS NULL AND "fraction_of_operation_id" IS NULL
    AND "event_suggestion_id" IS NULL
    AND "ratio_from" IS NULL AND "ratio_to" IS NULL AND "bonus_percent" IS NULL AND "bonus_unit_cost" IS NULL
  )
);
ALTER TABLE "investment_operations" ADD CONSTRAINT "investment_operations_cash_cost_check" CHECK ("cash_cost" IS NULL OR "type" = 'CONVERSION_OUT');
