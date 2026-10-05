-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME');

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "icon_color" TEXT NOT NULL DEFAULT '#000000',
    "type" "TransactionType" NOT NULL,
    "parent_id" TEXT,
    "depth_level" INTEGER NOT NULL DEFAULT 0,
    "owner" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_categories_owner_owner_id_idx" ON "financial_categories"("owner", "owner_id");

-- CreateIndex
CREATE INDEX "financial_categories_parent_id_idx" ON "financial_categories"("parent_id");

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "financial_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
