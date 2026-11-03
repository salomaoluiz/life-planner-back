-- Spec 078: keyset pages of the transactions list.
-- created_at keeps milliseconds only: the page cursor is built from a JS Date, so a finer value would make rows that
-- share a millisecond (imports, materialized series) skip or repeat across pages.
ALTER TABLE "financial_transactions" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3);

-- Serves the account list in its sort order (card rows have their own indexes).
CREATE INDEX "financial_transactions_account_list_idx"
  ON "financial_transactions" ("owner", "owner_id", "date" DESC, "created_at" DESC, "id" DESC)
  WHERE "credit_card_id" IS NULL;

-- Covered by the unique (recurrence_id, occurrence_number) and (installment_plan_id, installment_number).
DROP INDEX "financial_transactions_recurrence_id_idx";
DROP INDEX "financial_transactions_installment_plan_id_idx";
