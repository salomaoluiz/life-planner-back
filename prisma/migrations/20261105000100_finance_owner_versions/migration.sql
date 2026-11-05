-- Spec 092: one version number per finance owner (user or family), bumped by every write that can change what that
-- owner reads. The API builds its ETag from it and answers 304 before running the use case.
CREATE TABLE "finance_owner_versions" (
  "owner" "OwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "version" BIGINT NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "finance_owner_versions_pkey" PRIMARY KEY ("owner", "owner_id")
);

-- Bumps one owner at most once per database transaction (the keys already bumped live in a transaction-local setting).
CREATE FUNCTION "finance_bump_owner"(o "OwnerType", oid TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  k TEXT;
  seen TEXT;
BEGIN
  IF o IS NULL OR oid IS NULL THEN
    RETURN;
  END IF;

  k := '|' || o::text || ':' || oid || '|';
  seen := COALESCE(current_setting('lp.finance_bumped', true), '');

  IF position(k IN seen) > 0 THEN
    RETURN;
  END IF;

  PERFORM set_config('lp.finance_bumped', seen || k, true);

  INSERT INTO "finance_owner_versions" ("owner", "owner_id")
  VALUES (o, oid)
  ON CONFLICT ("owner", "owner_id")
  DO UPDATE SET "version" = "finance_owner_versions"."version" + 1, "updated_at" = now();
END
$$;

-- Tables that carry `owner` / `owner_id` themselves.
CREATE FUNCTION "finance_bump_direct"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM "finance_bump_owner"(OLD."owner", OLD."owner_id");
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM "finance_bump_owner"(NEW."owner", NEW."owner_id");
  END IF;
  RETURN NULL;
END
$$;

-- Categories and tags are shared by every scope that lists them: their readers are the owners of the scope rows.
CREATE FUNCTION "finance_bump_category"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  cid TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM "finance_bump_owner"(OLD."owner", OLD."owner_id");
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM "finance_bump_owner"(NEW."owner", NEW."owner_id");
  END IF;
  cid := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
  FOR r IN SELECT "owner", "owner_id" FROM "financial_category_scopes" WHERE "category_id" = cid LOOP
    PERFORM "finance_bump_owner"(r."owner", r."owner_id");
  END LOOP;
  RETURN NULL;
END
$$;

CREATE FUNCTION "finance_bump_tag"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  tid TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM "finance_bump_owner"(OLD."owner", OLD."owner_id");
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM "finance_bump_owner"(NEW."owner", NEW."owner_id");
  END IF;
  tid := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
  FOR r IN SELECT "owner", "owner_id" FROM "financial_tag_scopes" WHERE "tag_id" = tid LOOP
    PERFORM "finance_bump_owner"(r."owner", r."owner_id");
  END LOOP;
  RETURN NULL;
END
$$;

-- Tag membership of a transaction or a series belongs to the owner of that transaction or series.
CREATE FUNCTION "finance_bump_transaction_tag"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  tid TEXT;
BEGIN
  tid := CASE WHEN TG_OP = 'DELETE' THEN OLD."transaction_id" ELSE NEW."transaction_id" END;
  FOR r IN SELECT "owner", "owner_id" FROM "financial_transactions" WHERE "id" = tid LOOP
    PERFORM "finance_bump_owner"(r."owner", r."owner_id");
  END LOOP;
  RETURN NULL;
END
$$;

CREATE FUNCTION "finance_bump_recurrence_tag"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  rid TEXT;
BEGIN
  rid := CASE WHEN TG_OP = 'DELETE' THEN OLD."recurrence_id" ELSE NEW."recurrence_id" END;
  FOR r IN SELECT "owner", "owner_id" FROM "financial_recurrences" WHERE "id" = rid LOOP
    PERFORM "finance_bump_owner"(r."owner", r."owner_id");
  END LOOP;
  RETURN NULL;
END
$$;

-- Deferred to commit: the version row is locked for the shortest time and only once per transaction and owner.
CREATE CONSTRAINT TRIGGER "financial_accounts_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_accounts" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_direct"();
CREATE CONSTRAINT TRIGGER "financial_credit_cards_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_credit_cards" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_direct"();
CREATE CONSTRAINT TRIGGER "financial_transactions_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_transactions" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_direct"();
CREATE CONSTRAINT TRIGGER "financial_invoice_payments_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_credit_card_invoice_payments" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_direct"();
CREATE CONSTRAINT TRIGGER "financial_recurrences_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_recurrences" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_direct"();
CREATE CONSTRAINT TRIGGER "financial_installment_plans_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_installment_plans" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_direct"();
CREATE CONSTRAINT TRIGGER "financial_installment_prepayments_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_installment_prepayments" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_direct"();
CREATE CONSTRAINT TRIGGER "financial_category_scopes_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_category_scopes" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_direct"();
CREATE CONSTRAINT TRIGGER "financial_tag_scopes_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_tag_scopes" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_direct"();
CREATE CONSTRAINT TRIGGER "financial_categories_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_categories" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_category"();
CREATE CONSTRAINT TRIGGER "financial_tags_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_tags" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_tag"();
CREATE CONSTRAINT TRIGGER "financial_transaction_tags_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_transaction_tags" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_transaction_tag"();
CREATE CONSTRAINT TRIGGER "financial_recurrence_tags_bump_version" AFTER INSERT OR UPDATE OR DELETE ON "financial_recurrence_tags" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_bump_recurrence_tag"();
