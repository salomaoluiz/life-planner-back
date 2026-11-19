-- Spec 119: system category of the split adjustment (its own migration: a new enum value can't be used in the same transaction).
ALTER TYPE "SystemCategoryKey" ADD VALUE 'SPLIT_ADJUSTMENT';
