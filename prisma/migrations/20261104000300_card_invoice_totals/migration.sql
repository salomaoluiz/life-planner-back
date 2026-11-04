-- Spec 090: stored totals per (card, invoice month), written by every card-row write and backfilled here.
CREATE TABLE "financial_card_invoice_totals" (
  "credit_card_id" TEXT NOT NULL,
  "invoice_month" CHAR(7) NOT NULL,
  "income" INTEGER NOT NULL DEFAULT 0,
  "expense" INTEGER NOT NULL DEFAULT 0,
  "early_paid" INTEGER NOT NULL DEFAULT 0,
  "purchase_count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "financial_card_invoice_totals_pkey" PRIMARY KEY ("credit_card_id", "invoice_month")
);

ALTER TABLE "financial_card_invoice_totals"
  ADD CONSTRAINT "financial_card_invoice_totals_credit_card_id_fkey"
  FOREIGN KEY ("credit_card_id") REFERENCES "financial_credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "financial_card_invoice_totals" ("credit_card_id", "invoice_month", "income", "expense", "early_paid", "purchase_count")
SELECT
  t."credit_card_id",
  t."invoice_month",
  COALESCE(SUM(t."value") FILTER (WHERE t."type" = 'INCOME'), 0),
  COALESCE(SUM(t."value") FILTER (WHERE t."type" = 'EXPENSE'), 0),
  COALESCE(SUM(t."value") FILTER (WHERE t."category_id" = '00000000-0000-4000-8000-000000000005'), 0),
  COUNT(*)
FROM "financial_transactions" t
WHERE t."credit_card_id" IS NOT NULL
GROUP BY t."credit_card_id", t."invoice_month";
