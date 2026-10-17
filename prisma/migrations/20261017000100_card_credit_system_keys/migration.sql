-- AlterEnum: a new enum value cannot be used in the transaction that adds it, so the seeds are in the next migration.
ALTER TYPE "SystemCategoryKey" ADD VALUE 'INSTALLMENT_PREPAYMENT_DISCOUNT';
ALTER TYPE "SystemCategoryKey" ADD VALUE 'CARD_REFUND';
ALTER TYPE "SystemCategoryKey" ADD VALUE 'CARD_EARLY_PAYMENT';
