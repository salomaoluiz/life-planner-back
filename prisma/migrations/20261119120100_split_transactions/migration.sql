-- Spec 119: split transactions (header + parts that are ordinary rows with `split_id`).
CREATE TABLE "financial_splits" (
  "id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "notes" TEXT,
  "date" DATE NOT NULL,
  "account_id" TEXT,
  "credit_card_id" TEXT,
  "invoice_month" CHAR(7),
  "paid" BOOLEAN,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "recurrence_id" TEXT,
  "occurrence_number" INTEGER,
  "owner" "OwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "financial_splits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_splits_source_check" CHECK (("account_id" IS NOT NULL) <> ("credit_card_id" IS NOT NULL)),
  CONSTRAINT "financial_splits_notes_check" CHECK ("notes" IS NULL OR char_length("notes") <= 1000),
  CONSTRAINT "financial_splits_description_check" CHECK (char_length("description") BETWEEN 1 AND 200)
);
CREATE UNIQUE INDEX "financial_splits_recurrence_id_occurrence_number_key" ON "financial_splits"("recurrence_id", "occurrence_number");
CREATE INDEX "financial_splits_owner_owner_id_date_idx" ON "financial_splits"("owner", "owner_id", "date");
CREATE INDEX "financial_splits_account_id_idx" ON "financial_splits"("account_id");
CREATE INDEX "financial_splits_credit_card_id_invoice_month_idx" ON "financial_splits"("credit_card_id", "invoice_month");
ALTER TABLE "financial_splits" ADD CONSTRAINT "financial_splits_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_splits" ADD CONSTRAINT "financial_splits_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "financial_credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_splits" ADD CONSTRAINT "financial_splits_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "financial_recurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_transactions" ADD COLUMN "split_id" TEXT, ADD COLUMN "description_inherited" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "financial_transactions_split_id_idx" ON "financial_transactions"("split_id");
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_split_id_fkey" FOREIGN KEY ("split_id") REFERENCES "financial_splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- No `value` CHECK existed: only a split part may be negative (the SPLIT_ADJUSTMENT discount, FR 11); the category is checked by the use case.
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_value_check" CHECK ("value" > 0 OR ("split_id" IS NOT NULL AND "value" <> 0));
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_split_part_check" CHECK ("split_id" IS NULL OR ("installment_plan_id" IS NULL AND "transfer_id" IS NULL AND "projected" = false AND "prepayment_id" IS NULL AND "refunded_transaction_id" IS NULL));

ALTER TABLE "financial_recurrences" ADD COLUMN "split" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "financial_recurrence_parts" (
  "id" TEXT NOT NULL,
  "recurrence_id" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "category_id" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "description" TEXT,
  "sort_order" SMALLINT NOT NULL,
  CONSTRAINT "financial_recurrence_parts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_recurrence_parts_value_check" CHECK ("value" <> 0)
);
CREATE UNIQUE INDEX "financial_recurrence_parts_recurrence_id_sort_order_key" ON "financial_recurrence_parts"("recurrence_id", "sort_order");
CREATE INDEX "financial_recurrence_parts_category_id_idx" ON "financial_recurrence_parts"("category_id");
ALTER TABLE "financial_recurrence_parts" ADD CONSTRAINT "financial_recurrence_parts_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "financial_recurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_recurrence_parts" ADD CONSTRAINT "financial_recurrence_parts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "financial_recurrence_part_tags" (
  "part_id" TEXT NOT NULL,
  "tag_id" TEXT NOT NULL,
  "position" SMALLINT NOT NULL,
  CONSTRAINT "financial_recurrence_part_tags_pkey" PRIMARY KEY ("part_id", "tag_id")
);
CREATE INDEX "financial_recurrence_part_tags_tag_id_idx" ON "financial_recurrence_part_tags"("tag_id");
ALTER TABLE "financial_recurrence_part_tags" ADD CONSTRAINT "financial_recurrence_part_tags_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "financial_recurrence_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_recurrence_part_tags" ADD CONSTRAINT "financial_recurrence_part_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "financial_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: the fixed id is mirrored by SYSTEM_CATEGORY_IDS in the domain; counted in totals (not excluded).
INSERT INTO "financial_categories"
  ("id", "name", "icon", "icon_color", "type", "parent_id", "depth_level", "owner", "owner_id", "system_key", "exclude_from_totals", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-00000000000b', 'Discount/adjustment', 'percent', '#8A93A3', 'EXPENSE', NULL, 0, NULL, NULL, 'SPLIT_ADJUSTMENT', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Spec 092: owner-version triggers (the header and the series parts also bump their owner).
CREATE CONSTRAINT TRIGGER "financial_splits_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_splits" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_direct"();
CREATE CONSTRAINT TRIGGER "financial_recurrence_parts_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_recurrence_parts" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_recurrence_tag"();
