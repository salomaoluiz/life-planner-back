-- Spec 042: families can be archived (ACTIVE by default).
ALTER TABLE "families" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
