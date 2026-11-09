-- Spec 101: account types. Existing accounts become CHECKING through the default.
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'BROKERAGE', 'CASH', 'OTHER');

ALTER TABLE "financial_accounts" ADD COLUMN "type" "AccountType" NOT NULL DEFAULT 'CHECKING';
