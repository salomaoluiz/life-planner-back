-- Spec 041: categories can be archived (ACTIVE by default).
ALTER TABLE "financial_categories" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
