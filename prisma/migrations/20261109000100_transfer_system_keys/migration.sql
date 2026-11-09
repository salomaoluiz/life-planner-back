-- AlterEnum: a new enum value cannot be used in the transaction that adds it, so the seeds are in the next migration.
ALTER TYPE "SystemCategoryKey" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "SystemCategoryKey" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "SystemCategoryKey" ADD VALUE 'TRANSFER_FEE';
