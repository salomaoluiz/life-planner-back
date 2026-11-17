-- Spec 114: a series repeats every N days, weeks, months or years (`frequency_unit` + `frequency_interval`).
CREATE TYPE "RecurrenceUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

ALTER TABLE "financial_recurrences" ADD COLUMN "frequency_unit" "RecurrenceUnit";
ALTER TABLE "financial_recurrences" ADD COLUMN "frequency_interval" INTEGER NOT NULL DEFAULT 1;

-- Lossless: WEEKLY -> WEEK/1, BIWEEKLY -> WEEK/2, MONTHLY -> MONTH/1, YEARLY -> YEAR/1. No date or counter changes.
UPDATE "financial_recurrences"
SET
  "frequency_unit" = CASE "frequency"
    WHEN 'WEEKLY' THEN 'WEEK'::"RecurrenceUnit"
    WHEN 'BIWEEKLY' THEN 'WEEK'::"RecurrenceUnit"
    WHEN 'MONTHLY' THEN 'MONTH'::"RecurrenceUnit"
    WHEN 'YEARLY' THEN 'YEAR'::"RecurrenceUnit"
  END,
  "frequency_interval" = CASE "frequency" WHEN 'BIWEEKLY' THEN 2 ELSE 1 END;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "financial_recurrences" WHERE "frequency_unit" IS NULL OR "frequency_interval" IS NULL) THEN
    RAISE EXCEPTION 'spec 114: a recurrence row has no unit or interval after the backfill';
  END IF;
END $$;

ALTER TABLE "financial_recurrences" ALTER COLUMN "frequency_unit" SET NOT NULL;
ALTER TABLE "financial_recurrences" ADD CONSTRAINT "financial_recurrences_frequency_interval_check" CHECK (
  ("frequency_unit" = 'DAY' AND "frequency_interval" BETWEEN 1 AND 365)
  OR ("frequency_unit" = 'WEEK' AND "frequency_interval" BETWEEN 1 AND 52)
  OR ("frequency_unit" = 'MONTH' AND "frequency_interval" BETWEEN 1 AND 24)
  OR ("frequency_unit" = 'YEAR' AND "frequency_interval" BETWEEN 1 AND 10)
);

ALTER TABLE "financial_recurrences" DROP COLUMN "frequency";
DROP TYPE "RecurrenceFrequency";

-- Rollback (manual; refuses when a rule has no legacy equivalent):
--   CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY');
--   ALTER TABLE "financial_recurrences" ADD COLUMN "frequency" "RecurrenceFrequency";
--   UPDATE "financial_recurrences" SET "frequency" = CASE
--     WHEN "frequency_unit" = 'WEEK' AND "frequency_interval" = 1 THEN 'WEEKLY'::"RecurrenceFrequency"
--     WHEN "frequency_unit" = 'WEEK' AND "frequency_interval" = 2 THEN 'BIWEEKLY'::"RecurrenceFrequency"
--     WHEN "frequency_unit" = 'MONTH' AND "frequency_interval" = 1 THEN 'MONTHLY'::"RecurrenceFrequency"
--     WHEN "frequency_unit" = 'YEAR' AND "frequency_interval" = 1 THEN 'YEARLY'::"RecurrenceFrequency"
--   END;
--   -- abort when any row is still NULL (a rule such as MONTH/2 cannot be represented), then SET NOT NULL
--   ALTER TABLE "financial_recurrences" DROP CONSTRAINT "financial_recurrences_frequency_interval_check";
--   ALTER TABLE "financial_recurrences" DROP COLUMN "frequency_unit", DROP COLUMN "frequency_interval";
--   DROP TYPE "RecurrenceUnit";
