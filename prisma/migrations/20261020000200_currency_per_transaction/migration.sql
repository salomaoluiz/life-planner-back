-- Spec 040: currency per resource. Existing rows get BRL through the default.
ALTER TABLE "financial_accounts" ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL';
ALTER TABLE "financial_credit_cards" ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL';
ALTER TABLE "financial_transactions" ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL';
ALTER TABLE "financial_recurrences" ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL';
ALTER TABLE "financial_installment_plans" ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL';
