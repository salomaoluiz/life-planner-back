-- Spec 124: devices, preferences, notices (center), items and push deliveries. Additive only.

CREATE TYPE "PushProvider" AS ENUM ('EXPO', 'WEB_PUSH');
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');
CREATE TYPE "NotificationType" AS ENUM ('STOCK_EXPIRING', 'STOCK_OPENED_EXPIRING', 'FINANCE_BILL_DUE', 'FINANCE_INVOICE_DUE');
CREATE TYPE "NotificationKind" AS ENUM ('SUMMARY', 'URGENT');
CREATE TYPE "NotificationModule" AS ENUM ('STOCK', 'FINANCE');
CREATE TYPE "NotificationItemState" AS ENUM ('DUE_TODAY', 'OVERDUE', 'UPCOMING');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'INVALID');

CREATE TABLE "notification_devices" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" "PushProvider" NOT NULL,
  "platform" "DevicePlatform" NOT NULL,
  "token" TEXT NOT NULL,
  "web_p256dh" TEXT,
  "web_auth" TEXT,
  "name" VARCHAR(60) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notification_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_devices_web_keys_check" CHECK (
    ("provider" = 'WEB_PUSH' AND "web_p256dh" IS NOT NULL AND "web_auth" IS NOT NULL)
    OR ("provider" = 'EXPO' AND "web_p256dh" IS NULL AND "web_auth" IS NULL)
  )
);
CREATE UNIQUE INDEX "notification_devices_token_key" ON "notification_devices"("token");
CREATE INDEX "notification_devices_user_id_idx" ON "notification_devices"("user_id");
CREATE INDEX "notification_devices_last_seen_at_idx" ON "notification_devices"("last_seen_at");
ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_preferences" (
  "user_id" TEXT NOT NULL,
  "disabled_types" "NotificationType"[] DEFAULT ARRAY[]::"NotificationType"[],
  "bill_lead_days" SMALLINT NOT NULL DEFAULT 3,
  "invoice_lead_days" SMALLINT NOT NULL DEFAULT 3,
  "summary_minute" SMALLINT NOT NULL DEFAULT 480,
  "quiet_start_minute" SMALLINT NOT NULL DEFAULT 1320,
  "quiet_end_minute" SMALLINT NOT NULL DEFAULT 420,
  "time_zone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  "locale" VARCHAR(5) NOT NULL DEFAULT 'pt-BR',
  "last_summary_on" DATE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "notification_preferences_ranges_check" CHECK (
    "bill_lead_days" BETWEEN 0 AND 30 AND "invoice_lead_days" BETWEEN 0 AND 30
    AND "summary_minute" BETWEEN 0 AND 1439 AND "quiet_start_minute" BETWEEN 0 AND 1439 AND "quiet_end_minute" BETWEEN 0 AND 1439
  ),
  CONSTRAINT "notification_preferences_locale_check" CHECK ("locale" IN ('pt-BR', 'en-US'))
);
CREATE INDEX "notification_preferences_last_summary_on_idx" ON "notification_preferences"("last_summary_on");
CREATE INDEX "notification_preferences_summary_minute_idx" ON "notification_preferences"("summary_minute");
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_family_preferences" (
  "user_id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "notification_family_preferences_pkey" PRIMARY KEY ("user_id", "family_id")
);
ALTER TABLE "notification_family_preferences" ADD CONSTRAINT "notification_family_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_family_preferences" ADD CONSTRAINT "notification_family_preferences_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "local_date" DATE NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "body" VARCHAR(300) NOT NULL,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_user_id_created_at_id_idx" ON "notifications"("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "notifications_unread_idx" ON "notifications"("user_id") WHERE "read_at" IS NULL;
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_items" (
  "id" TEXT NOT NULL,
  "notification_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "module" "NotificationModule" NOT NULL,
  "state" "NotificationItemState" NOT NULL,
  "source_id" VARCHAR(80) NOT NULL,
  "owner" "OwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "due_date" DATE NOT NULL,
  "dedupe_key" VARCHAR(160) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "route" VARCHAR(200) NOT NULL,
  "position" SMALLINT NOT NULL,
  CONSTRAINT "notification_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notification_items_user_id_dedupe_key_idx" ON "notification_items"("user_id", "dedupe_key");
CREATE INDEX "notification_items_notification_id_idx" ON "notification_items"("notification_id");
CREATE INDEX "notification_items_owner_owner_id_idx" ON "notification_items"("owner", "owner_id");
ALTER TABLE "notification_items" ADD CONSTRAINT "notification_items_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_items" ADD CONSTRAINT "notification_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_deliveries" (
  "id" TEXT NOT NULL,
  "notification_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" SMALLINT NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ticket_id" VARCHAR(64),
  "error" VARCHAR(200),
  "sent_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notification_deliveries_device_id_idx" ON "notification_deliveries"("device_id");
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");
CREATE INDEX "notification_deliveries_pending_idx" ON "notification_deliveries"("next_attempt_at") WHERE "status" = 'PENDING';
CREATE INDEX "notification_deliveries_receipts_idx" ON "notification_deliveries"("sent_at") WHERE "status" = 'SENT' AND "ticket_id" IS NOT NULL;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "notification_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
