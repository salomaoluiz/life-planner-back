-- Spec 082: serves the unpaid rows of /finance/upcoming (overdue has no lower date bound).
CREATE INDEX "financial_transactions_owner_unpaid_idx"
  ON "financial_transactions" ("owner", "owner_id", "date")
  WHERE "paid" = false;
