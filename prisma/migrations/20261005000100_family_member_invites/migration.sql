-- AlterTable
ALTER TABLE "family_members" ADD COLUMN     "invite_expires_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "family_members_family_id_user_id_key" ON "family_members"("family_id", "user_id");

