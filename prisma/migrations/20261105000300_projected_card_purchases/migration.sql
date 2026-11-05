-- Spec 096: projected card purchases. Additive with defaults; every existing row is effective.
ALTER TABLE "financial_transactions" ADD COLUMN "projected" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_projected_check"
  CHECK (
    "projected" = false OR (
      "credit_card_id" IS NOT NULL
      AND "type" = 'EXPENSE'
      AND "installment_plan_id" IS NULL
      AND "refunded_transaction_id" IS NULL
      AND "prepayment_id" IS NULL
      AND "payment_method" IS NULL
    )
  );

ALTER TABLE "financial_recurrences" ADD COLUMN "projected" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "financial_recurrences"
  ADD CONSTRAINT "financial_recurrences_projected_check"
  CHECK ("projected" = false OR ("credit_card_id" IS NOT NULL AND "type" = 'EXPENSE'));

ALTER TABLE "financial_card_invoice_totals"
  ADD COLUMN "projected_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "projected_count" INTEGER NOT NULL DEFAULT 0;
