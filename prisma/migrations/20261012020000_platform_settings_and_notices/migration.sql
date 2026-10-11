-- Platform-wide settings edited in Super-admin → Settings: how businesses pay
-- their plan (SINPE Móvil) and how to reach support. Exactly one row (id = 1).
CREATE TABLE "app"."platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "support_email" VARCHAR(254),
    "support_whatsapp" VARCHAR(32),
    "sinpe_phone" VARCHAR(32),
    "sinpe_name" VARCHAR(120),
    "payment_note" VARCHAR(600),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    "updated_by_user_id" UUID,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_settings_singleton" CHECK ("id" = 1)
);

ALTER TABLE "app"."platform_settings"
  ADD CONSTRAINT "platform_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id")
  REFERENCES "app"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "app"."platform_settings" ("id") VALUES (1);

-- Owner warning emails sent by the daily billing job, each at most once per
-- period (reset when a payment is recorded).
ALTER TABLE "app"."tenants"
  ADD COLUMN "notified_ending_at" TIMESTAMPTZ(3),
  ADD COLUMN "notified_closed_at" TIMESTAMPTZ(3),
  ADD COLUMN "notified_deletion_at" TIMESTAMPTZ(3);

ALTER TABLE "app"."platform_settings" ENABLE ROW LEVEL SECURITY;
SELECT "app"."tempo_apply_grants"();
