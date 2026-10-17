-- AlterTable
ALTER TABLE "financial_transactions"
  ADD COLUMN "refunded_transaction_id" TEXT,
  ADD COLUMN "refunded_plan_id" TEXT,
  ADD COLUMN "prepayment_id" TEXT,
  ADD COLUMN "payment_method" "InvoicePaymentMethod",
  ADD COLUMN "paid_from_transaction_id" TEXT;

-- CreateTable
CREATE TABLE "financial_installment_prepayments" (
    "id" TEXT NOT NULL,
    "installment_plan_id" TEXT NOT NULL,
    "target_invoice_month" CHAR(7) NOT NULL,
    "original_months" JSONB NOT NULL,
    "discount_transaction_id" TEXT,
    "date" DATE NOT NULL,
    "owner" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_installment_prepayments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_installment_prepayments_installment_plan_id_key" ON "financial_installment_prepayments"("installment_plan_id");
CREATE UNIQUE INDEX "financial_installment_prepayments_discount_transaction_id_key" ON "financial_installment_prepayments"("discount_transaction_id");
CREATE INDEX "financial_installment_prepayments_owner_owner_id_idx" ON "financial_installment_prepayments"("owner", "owner_id");
CREATE UNIQUE INDEX "financial_transactions_paid_from_transaction_id_key" ON "financial_transactions"("paid_from_transaction_id");
CREATE INDEX "financial_transactions_refunded_transaction_id_idx" ON "financial_transactions"("refunded_transaction_id");
CREATE INDEX "financial_transactions_refunded_plan_id_idx" ON "financial_transactions"("refunded_plan_id");
CREATE INDEX "financial_transactions_prepayment_id_idx" ON "financial_transactions"("prepayment_id");

-- AddForeignKey
ALTER TABLE "financial_installment_prepayments" ADD CONSTRAINT "financial_installment_prepayments_installment_plan_id_fkey"
  FOREIGN KEY ("installment_plan_id") REFERENCES "financial_installment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_installment_prepayments" ADD CONSTRAINT "financial_installment_prepayments_discount_transaction_id_fkey"
  FOREIGN KEY ("discount_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_refunded_transaction_id_fkey"
  FOREIGN KEY ("refunded_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_refunded_plan_id_fkey"
  FOREIGN KEY ("refunded_plan_id") REFERENCES "financial_installment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_prepayment_id_fkey"
  FOREIGN KEY ("prepayment_id") REFERENCES "financial_installment_prepayments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_paid_from_transaction_id_fkey"
  FOREIGN KEY ("paid_from_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seeds: the fixed ids are mirrored by SYSTEM_CATEGORY_IDS in the domain.
INSERT INTO "financial_categories"
  ("id", "name", "icon", "icon_color", "type", "parent_id", "depth_level", "owner", "owner_id", "system_key", "exclude_from_totals", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000003', 'Prepayment discount', 'tag-minus', '#4CAF50', 'INCOME', NULL, 0, NULL, NULL, 'INSTALLMENT_PREPAYMENT_DISCOUNT', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000004', 'Refund', 'cash-refund', '#4CAF50', 'INCOME', NULL, 0, NULL, NULL, 'CARD_REFUND', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000005', 'Early payment', 'cash-fast', '#4CAF50', 'INCOME', NULL, 0, NULL, NULL, 'CARD_EARLY_PAYMENT', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Card credits (spec 032 FR 3): the only INCOME rows allowed on a card are the three system categories.
ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_card_income_check"
  CHECK ("credit_card_id" IS NULL OR "type" = 'EXPENSE' OR "category_id" IN (
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005')),
  ADD CONSTRAINT "financial_transactions_payment_method_check"
  CHECK ("payment_method" IS NULL OR "category_id" = '00000000-0000-4000-8000-000000000005'),
  ADD CONSTRAINT "financial_transactions_early_method_required_check"
  CHECK ("category_id" <> '00000000-0000-4000-8000-000000000005' OR "payment_method" IS NOT NULL),
  ADD CONSTRAINT "financial_transactions_paid_from_only_account_check"
  CHECK ("paid_from_transaction_id" IS NULL OR "payment_method" = 'ACCOUNT'),
  ADD CONSTRAINT "financial_transactions_account_method_needs_debit_check"
  CHECK ("payment_method" IS DISTINCT FROM 'ACCOUNT' OR "paid_from_transaction_id" IS NOT NULL);
