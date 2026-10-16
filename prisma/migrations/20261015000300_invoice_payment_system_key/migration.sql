-- AlterEnum: a new enum value cannot be used in the transaction that adds it, so the seed is in the next migration.
ALTER TYPE "SystemCategoryKey" ADD VALUE 'INVOICE_PAYMENT';
