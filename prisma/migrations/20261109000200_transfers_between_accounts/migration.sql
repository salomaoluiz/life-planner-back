-- Spec 098: transfers between accounts.
CREATE TABLE "financial_transfers" (
  "id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "notes" TEXT,
  "from_account_id" TEXT,
  "to_account_id" TEXT,
  "amount_out" INTEGER NOT NULL,
  "amount_in" INTEGER,
  "currency_out" VARCHAR(3) NOT NULL,
  "currency_in" VARCHAR(3) NOT NULL,
  "date_out" DATE NOT NULL,
  "date_in" DATE NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "fee" INTEGER,
  "recurrence_id" TEXT,
  "occurrence_number" INTEGER,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "financial_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_transfers_accounts_differ_check" CHECK ("from_account_id" <> "to_account_id"),
  CONSTRAINT "financial_transfers_dates_check" CHECK ("date_in" >= "date_out"),
  CONSTRAINT "financial_transfers_amount_out_check" CHECK ("amount_out" > 0),
  CONSTRAINT "financial_transfers_amount_in_check" CHECK ("amount_in" IS NULL OR "amount_in" > 0),
  CONSTRAINT "financial_transfers_fee_check" CHECK ("fee" IS NULL OR "fee" > 0),
  CONSTRAINT "financial_transfers_notes_check" CHECK ("notes" IS NULL OR char_length("notes") <= 1000)
);

CREATE UNIQUE INDEX "financial_transfers_recurrence_id_occurrence_number_key" ON "financial_transfers"("recurrence_id", "occurrence_number");
CREATE INDEX "financial_transfers_from_account_id_idx" ON "financial_transfers"("from_account_id");
CREATE INDEX "financial_transfers_to_account_id_idx" ON "financial_transfers"("to_account_id");

ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "financial_recurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_transactions" ADD COLUMN "transfer_id" TEXT;
CREATE INDEX "financial_transactions_transfer_id_idx" ON "financial_transactions"("transfer_id");
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "financial_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_recurrences" ADD COLUMN "to_account_id" TEXT, ADD COLUMN "amount_in" INTEGER;
CREATE INDEX "financial_recurrences_to_account_id_idx" ON "financial_recurrences"("to_account_id");
ALTER TABLE "financial_recurrences" ADD CONSTRAINT "financial_recurrences_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_recurrences" ADD CONSTRAINT "financial_recurrences_destination_check" CHECK ("to_account_id" IS NULL OR "credit_card_id" IS NULL);

-- Seeds: the fixed ids are mirrored by SYSTEM_CATEGORY_IDS in the domain.
INSERT INTO "financial_categories"
  ("id", "name", "icon", "icon_color", "type", "parent_id", "depth_level", "owner", "owner_id", "system_key", "exclude_from_totals", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000006', 'Transfer out', 'bank-transfer-out', '#5A6273', 'EXPENSE', NULL, 0, NULL, NULL, 'TRANSFER_OUT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000007', 'Transfer in', 'bank-transfer-in', '#5A6273', 'INCOME', NULL, 0, NULL, NULL, 'TRANSFER_IN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000008', 'Transfer fees', 'percent', '#5A6273', 'EXPENSE', NULL, 0, NULL, NULL, 'TRANSFER_FEE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
