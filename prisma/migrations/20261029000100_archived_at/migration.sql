-- Spec 052: the day an account or card was archived (NULL while active); the dashboard stops counting it from that day.
ALTER TABLE "financial_accounts" ADD COLUMN "archived_at" TIMESTAMPTZ(6);
ALTER TABLE "financial_credit_cards" ADD COLUMN "archived_at" TIMESTAMPTZ(6);

-- Backfill: rows already archived get updated_at, the best known approximation of when they were archived.
UPDATE "financial_accounts" SET "archived_at" = "updated_at" WHERE "status" = 'ARCHIVED';
UPDATE "financial_credit_cards" SET "archived_at" = "updated_at" WHERE "status" = 'ARCHIVED';
