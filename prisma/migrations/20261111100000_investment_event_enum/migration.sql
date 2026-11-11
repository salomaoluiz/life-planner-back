-- Spec 108: corporate event operation types. Own migration: PostgreSQL can't use a new enum value in the transaction that adds it.
ALTER TYPE "InvestmentOperationType" ADD VALUE 'SPLIT';
ALTER TYPE "InvestmentOperationType" ADD VALUE 'REVERSE_SPLIT';
ALTER TYPE "InvestmentOperationType" ADD VALUE 'BONUS';
