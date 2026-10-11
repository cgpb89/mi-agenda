-- What each plan includes (limits, features, prices). Edited by platform admins
-- in Super-admin → Plans; read on every request through modules/plans/service.ts.
CREATE TABLE "app"."plan_settings" (
    "plan" "app"."Plan" NOT NULL,
    "price_crc_minor" INTEGER NOT NULL DEFAULT 0,
    "price_usd_minor" INTEGER NOT NULL DEFAULT 0,
    -- NULL = unlimited.
    "staff_limit" INTEGER,
    "photo_limit" INTEGER NOT NULL DEFAULT 3,
    -- Array of feature keys (modules/plans/features.ts).
    "features" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    "updated_by_user_id" UUID,

    CONSTRAINT "plan_settings_pkey" PRIMARY KEY ("plan"),
    CONSTRAINT "plan_settings_prices" CHECK ("price_crc_minor" >= 0 AND "price_usd_minor" >= 0),
    CONSTRAINT "plan_settings_staff_limit" CHECK ("staff_limit" IS NULL OR "staff_limit" BETWEEN 1 AND 1000),
    CONSTRAINT "plan_settings_photo_limit" CHECK ("photo_limit" BETWEEN 0 AND 20),
    CONSTRAINT "plan_settings_features_array" CHECK (jsonb_typeof("features") = 'array')
);

ALTER TABLE "app"."plan_settings"
  ADD CONSTRAINT "plan_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id")
  REFERENCES "app"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defaults agreed for launch. Trial gets the Growth features.
INSERT INTO "app"."plan_settings" ("plan", "price_crc_minor", "price_usd_minor", "staff_limit", "photo_limit", "features") VALUES
  ('TRIAL',    0,        0,    5,    6,  '["customerDirectory","fullAnalytics","brandColors","glassStyle","emailReminders","sinpeDeposits","waitlist"]'),
  ('STARTER',  850000,   1700, 1,    3,  '[]'),
  ('GROWTH',   1500000,  2900, 5,    6,  '["customerDirectory","fullAnalytics","brandColors","glassStyle","emailReminders","sinpeDeposits","waitlist"]'),
  ('BUSINESS', 3000000,  5900, NULL, 10, '["customerDirectory","fullAnalytics","brandColors","glassStyle","emailReminders","sinpeDeposits","waitlist","hideBranding"]');

-- Photo count is now a per-plan limit; keep a hard ceiling in the database.
ALTER TABLE "app"."business_profiles" DROP CONSTRAINT "business_profiles_photos_max";
ALTER TABLE "app"."business_profiles"
  ADD CONSTRAINT "business_profiles_photos_max" CHECK (
    jsonb_typeof("photos") = 'array' AND jsonb_array_length("photos") <= 20
  );

-- New table: deny-by-default RLS like every other table, then runtime grants.
ALTER TABLE "app"."plan_settings" ENABLE ROW LEVEL SECURITY;
SELECT "app"."tempo_apply_grants"();
