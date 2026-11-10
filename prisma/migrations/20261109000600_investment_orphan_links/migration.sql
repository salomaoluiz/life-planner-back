-- Spec 102 FR 23: when the account of an operation is deleted (purge, spec 024) the FK sets `account_id` to NULL; the
-- operation then stops generating a finance entry, instead of breaking the CHECK of `investment_operations`.
CREATE OR REPLACE FUNCTION investment_operations_clear_link() RETURNS trigger AS $$
BEGIN
  IF NEW."account_id" IS NULL AND NEW."generate_transaction" THEN
    NEW."generate_transaction" := false;
    NEW."transaction_id" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER investment_operations_clear_link
  BEFORE UPDATE ON "investment_operations"
  FOR EACH ROW EXECUTE FUNCTION investment_operations_clear_link();
