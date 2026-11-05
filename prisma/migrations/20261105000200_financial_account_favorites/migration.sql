-- Spec 094: the favorite account of a user (at most one per user).
CREATE TABLE "financial_account_favorites" (
  "user_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "financial_account_favorites_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX "financial_account_favorites_account_id_idx" ON "financial_account_favorites"("account_id");

ALTER TABLE "financial_account_favorites" ADD CONSTRAINT "financial_account_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_account_favorites" ADD CONSTRAINT "financial_account_favorites_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Spec 092: `isFavorite` is part of what the user's account reads return, so a change bumps the version of the user's own owner.
CREATE FUNCTION "finance_bump_favorite"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM "finance_bump_owner"('USER', OLD."user_id");
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM "finance_bump_owner"('USER', NEW."user_id");
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "financial_account_favorites_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_account_favorites" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_favorite"();
