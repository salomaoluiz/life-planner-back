-- AlterTable
ALTER TABLE "financial_categories" ADD COLUMN     "all_scopes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creator_id" TEXT;

-- CreateTable
CREATE TABLE "financial_category_scopes" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "owner" "OwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,

    CONSTRAINT "financial_category_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_category_scopes_owner_owner_id_idx" ON "financial_category_scopes"("owner", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_category_scopes_category_id_owner_owner_id_key" ON "financial_category_scopes"("category_id", "owner", "owner_id");

-- AddForeignKey
ALTER TABLE "financial_category_scopes" ADD CONSTRAINT "financial_category_scopes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
