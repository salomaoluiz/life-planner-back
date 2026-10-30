-- Spec 059: optional free-text notes on transactions, installment plans and recurring series.
ALTER TABLE "financial_transactions" ADD COLUMN "notes" TEXT;
ALTER TABLE "financial_installment_plans" ADD COLUMN "notes" TEXT;
ALTER TABLE "financial_recurrences" ADD COLUMN "notes" TEXT;

ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_notes_len_check" CHECK (char_length("notes") <= 1000);
ALTER TABLE "financial_installment_plans" ADD CONSTRAINT "financial_installment_plans_notes_len_check" CHECK (char_length("notes") <= 1000);
ALTER TABLE "financial_recurrences" ADD CONSTRAINT "financial_recurrences_notes_len_check" CHECK (char_length("notes") <= 1000);
