-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN     "installment_number" SMALLINT,
ADD COLUMN     "installment_plan_id" TEXT;

-- CreateTable
CREATE TABLE "financial_installment_plans" (
    "id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "total_value" INTEGER NOT NULL,
    "installment_count" SMALLINT NOT NULL,
    "date" DATE NOT NULL,
    "owner" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_installment_plans_credit_card_id_idx" ON "financial_installment_plans"("credit_card_id");

-- CreateIndex
CREATE INDEX "financial_installment_plans_category_id_idx" ON "financial_installment_plans"("category_id");

-- CreateIndex
CREATE INDEX "financial_installment_plans_owner_owner_id_idx" ON "financial_installment_plans"("owner", "owner_id");

-- CreateIndex
CREATE INDEX "financial_transactions_installment_plan_id_idx" ON "financial_transactions"("installment_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_installment_plan_id_installment_numb_key" ON "financial_transactions"("installment_plan_id", "installment_number");

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_installment_plan_id_fkey" FOREIGN KEY ("installment_plan_id") REFERENCES "financial_installment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_installment_plans" ADD CONSTRAINT "financial_installment_plans_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "financial_credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_installment_plans" ADD CONSTRAINT "financial_installment_plans_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A row is in a plan exactly when it has a number, and only card purchases can be installments.
ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_installment_pair_check"
  CHECK (("installment_plan_id" IS NULL) = ("installment_number" IS NULL)),
  ADD CONSTRAINT "financial_transactions_installment_card_check"
  CHECK ("installment_plan_id" IS NULL OR "credit_card_id" IS NOT NULL);
