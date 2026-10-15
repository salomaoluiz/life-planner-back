-- CreateEnum
CREATE TYPE "CreditCardBrand" AS ENUM ('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'OTHER');

-- CreateTable
CREATE TABLE "financial_credit_cards" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "brand" "CreditCardBrand" NOT NULL,
    "closing_day" SMALLINT NOT NULL,
    "due_day" SMALLINT NOT NULL,
    "payment_day" SMALLINT,
    "color" TEXT NOT NULL,
    "last_digits" CHAR(4),
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "owner" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_credit_cards_owner_owner_id_idx" ON "financial_credit_cards"("owner", "owner_id");
