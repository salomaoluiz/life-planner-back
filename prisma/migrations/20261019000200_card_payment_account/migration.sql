-- AlterTable
ALTER TABLE "financial_credit_cards" ADD COLUMN     "payment_account_id" TEXT;

-- CreateIndex
CREATE INDEX "financial_credit_cards_payment_account_id_idx" ON "financial_credit_cards"("payment_account_id");

-- AddForeignKey
ALTER TABLE "financial_credit_cards" ADD CONSTRAINT "financial_credit_cards_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
