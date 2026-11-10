-- AlterEnum: a new enum value cannot be used in the transaction that adds it, so the seeds are in the next migration.
ALTER TYPE "SystemCategoryKey" ADD VALUE 'INVESTMENT_CONTRIBUTION';
ALTER TYPE "SystemCategoryKey" ADD VALUE 'INVESTMENT_REDEMPTION';
