-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurrenceStatus" AS ENUM ('ACTIVE', 'ENDED');

-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN     "occurrence_number" INTEGER,
ADD COLUMN     "recurrence_id" TEXT;

-- CreateTable
CREATE TABLE "financial_recurrences" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category_id" TEXT NOT NULL,
    "account_id" TEXT,
    "credit_card_id" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "first_number" INTEGER NOT NULL DEFAULT 1,
    "last_generated_number" INTEGER NOT NULL DEFAULT 0,
    "next_occurrence_date" DATE,
    "skipped_numbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "status" "RecurrenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "owner" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_recurrences_owner_owner_id_status_next_occurrence_idx" ON "financial_recurrences"("owner", "owner_id", "status", "next_occurrence_date");

-- CreateIndex
CREATE INDEX "financial_recurrences_account_id_idx" ON "financial_recurrences"("account_id");

-- CreateIndex
CREATE INDEX "financial_recurrences_credit_card_id_idx" ON "financial_recurrences"("credit_card_id");

-- CreateIndex
CREATE INDEX "financial_recurrences_category_id_idx" ON "financial_recurrences"("category_id");

-- CreateIndex
CREATE INDEX "financial_transactions_recurrence_id_idx" ON "financial_transactions"("recurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_recurrence_id_occurrence_number_key" ON "financial_transactions"("recurrence_id", "occurrence_number");

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "financial_recurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_recurrences" ADD CONSTRAINT "financial_recurrences_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_recurrences" ADD CONSTRAINT "financial_recurrences_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_recurrences" ADD CONSTRAINT "financial_recurrences_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "financial_credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A series belongs to an account XOR a card; a card series is always an expense.
ALTER TABLE "financial_recurrences"
  ADD CONSTRAINT "financial_recurrences_source_check"
  CHECK (("account_id" IS NULL) <> ("credit_card_id" IS NULL)),
  ADD CONSTRAINT "financial_recurrences_card_expense_check"
  CHECK ("credit_card_id" IS NULL OR "type" = 'EXPENSE'),
  ADD CONSTRAINT "financial_recurrences_end_check"
  CHECK ("end_date" IS NULL OR "end_date" >= "start_date");

-- A row is in a series exactly when it has a number, and a series row is never an installment.
ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_recurrence_pair_check"
  CHECK (("recurrence_id" IS NULL) = ("occurrence_number" IS NULL)),
  ADD CONSTRAINT "financial_transactions_recurrence_installment_check"
  CHECK ("recurrence_id" IS NULL OR "installment_plan_id" IS NULL);
