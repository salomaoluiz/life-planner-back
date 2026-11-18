-- Spec 117: quick movement. Per-item step, gesture grouping and idempotency key on movements.
ALTER TABLE "stock_items" ADD COLUMN "quick_step" DECIMAL(14, 3);
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_quick_step_check" CHECK ("quick_step" IS NULL OR "quick_step" > 0);

ALTER TABLE "stock_movements"
  ADD COLUMN "gesture_id" UUID,
  ADD COLUMN "client_id" UUID;

CREATE INDEX "stock_movements_gesture_id_idx" ON "stock_movements"("gesture_id");
CREATE UNIQUE INDEX "stock_movements_user_client_key" ON "stock_movements"("user_id", "client_id") WHERE "client_id" IS NOT NULL;
-- "Frequent" items: movements of the last 30 days across owners.
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements"("created_at");
