-- CreateEnum
CREATE TYPE "StockUnit" AS ENUM ('unit', 'gram', 'kilogram', 'liter', 'milliliter');

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "owner" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" "StockUnit" NOT NULL,
    "brand" TEXT,
    "barcode" TEXT,
    "notes" TEXT,
    "purchase_date" TIMESTAMPTZ(6),
    "opening_date" TIMESTAMPTZ(6),
    "expiration_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_items_owner_owner_id_idx" ON "stock_items"("owner", "owner_id");
