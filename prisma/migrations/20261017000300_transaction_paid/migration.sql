-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN "paid" BOOLEAN;

-- Existing rows: up to today are paid, future ones are not (balances do not move on the migration day).
UPDATE "financial_transactions" SET "paid" = ("date" <= CURRENT_DATE) WHERE "account_id" IS NOT NULL;

-- System rows (adjustments, invoice payments) are always paid.
UPDATE "financial_transactions" SET "paid" = true
WHERE "account_id" IS NOT NULL
  AND "category_id" IN (SELECT "id" FROM "financial_categories" WHERE "system_key" IS NOT NULL);

-- Account rows carry a status, card rows never do.
ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_paid_check" CHECK (("credit_card_id" IS NULL) = ("paid" IS NOT NULL));

-- CreateIndex
CREATE INDEX "financial_transactions_unpaid_idx" ON "financial_transactions"("account_id", "date") WHERE "paid" = false;

-- The ledger now counts only the paid rows.
UPDATE "financial_accounts" AS a SET "ledger_balance" = a."initial_balance" + COALESCE((
  SELECT SUM(CASE WHEN t."type" = 'INCOME' THEN t."value" ELSE -t."value" END)
  FROM "financial_transactions" t
  WHERE t."account_id" = a."id" AND t."paid" = true
), 0);
