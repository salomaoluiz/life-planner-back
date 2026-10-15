-- CreateEnum
CREATE TYPE "InvoicePaymentMethod" AS ENUM ('ACCOUNT', 'EXTERNAL');

-- AlterTable: a transaction is on an account OR on a credit card.
ALTER TABLE "financial_transactions"
  ALTER COLUMN "account_id" DROP NOT NULL,
  ADD COLUMN "credit_card_id" TEXT,
  ADD COLUMN "invoice_month" CHAR(7);

ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_credit_card_id_fkey"
  FOREIGN KEY ("credit_card_id") REFERENCES "financial_credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_source_check"
  CHECK (num_nonnulls("account_id", "credit_card_id") = 1);
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_invoice_month_check"
  CHECK (("credit_card_id" IS NULL) = ("invoice_month" IS NULL));

CREATE INDEX "financial_transactions_credit_card_id_invoice_month_idx" ON "financial_transactions"("credit_card_id", "invoice_month");

-- CreateTable
CREATE TABLE "financial_credit_card_invoice_payments" (
    "id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,
    "invoice_month" CHAR(7) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_on" DATE NOT NULL,
    "method" "InvoicePaymentMethod" NOT NULL,
    "account_id" TEXT,
    "transaction_id" TEXT,
    "owner" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_credit_card_invoice_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_credit_card_invoice_payments_transaction_id_key" ON "financial_credit_card_invoice_payments"("transaction_id");
CREATE UNIQUE INDEX "financial_credit_card_invoice_payments_credit_card_id_invoice_month_key" ON "financial_credit_card_invoice_payments"("credit_card_id", "invoice_month");
CREATE INDEX "financial_credit_card_invoice_payments_owner_owner_id_idx" ON "financial_credit_card_invoice_payments"("owner", "owner_id");

ALTER TABLE "financial_credit_card_invoice_payments" ADD CONSTRAINT "financial_credit_card_invoice_payments_credit_card_id_fkey"
  FOREIGN KEY ("credit_card_id") REFERENCES "financial_credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_credit_card_invoice_payments" ADD CONSTRAINT "financial_credit_card_invoice_payments_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_credit_card_invoice_payments" ADD CONSTRAINT "financial_credit_card_invoice_payments_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: the fixed id is mirrored by SYSTEM_CATEGORY_IDS in the domain.
INSERT INTO "financial_categories"
  ("id", "name", "icon", "icon_color", "type", "parent_id", "depth_level", "owner", "owner_id", "system_key", "exclude_from_totals", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000002', 'Invoice payment', 'credit-card-check', '#607D8B', 'EXPENSE', NULL, 0, NULL, NULL, 'INVOICE_PAYMENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
