-- ─────────────────────────────────────────────────────────────────────────────
-- Tempo: database-enforced invariants and access control that Prisma's schema
-- language cannot express. Hand-written; keep in sync with schema.prisma.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. btree_gist lets a GiST exclusion constraint combine equality on uuid
--    columns with range overlap. Supabase installs extensions in `extensions`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
  ELSE
    CREATE EXTENSION IF NOT EXISTS btree_gist;
  END IF;
END
$$;

-- 2. No overlapping appointments for the same staff member.
--    Half-open intervals [block_start, block_end) — back-to-back is allowed.
--    Buffers are included in block_*. CANCELLED and NO_SHOW free the time.
ALTER TABLE "app"."appointments"
  ADD CONSTRAINT "appointments_no_staff_overlap"
  EXCLUDE USING gist (
    "tenant_id" WITH =,
    "staff_id" WITH =,
    tstzrange("block_start_at", "block_end_at", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING', 'CONFIRMED', 'COMPLETED'));

-- 3. CHECK constraints ---------------------------------------------------------
ALTER TABLE "app"."users"
  ADD CONSTRAINT "users_email_normalised" CHECK ("email" = lower(btrim("email")) AND "email" LIKE '%_@_%');

ALTER TABLE "app"."tenants"
  ADD CONSTRAINT "tenants_slug_format" CHECK ("slug" ~ '^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$' AND "slug" NOT LIKE '%--%'),
  ADD CONSTRAINT "tenants_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "tenants_country_format" CHECK ("country" ~ '^[A-Z]{2}$');

ALTER TABLE "app"."booking_policies"
  ADD CONSTRAINT "booking_policies_max_active_range" CHECK ("max_active_appointments_per_phone" BETWEEN 1 AND 20),
  ADD CONSTRAINT "booking_policies_slot_interval" CHECK ("slot_interval_min" IN (5, 10, 15, 20, 30, 60)),
  ADD CONSTRAINT "booking_policies_min_notice" CHECK ("min_notice_min" BETWEEN 0 AND 10080),
  ADD CONSTRAINT "booking_policies_max_advance" CHECK ("max_advance_days" BETWEEN 1 AND 365),
  ADD CONSTRAINT "booking_policies_cancel_window" CHECK ("cancellation_window_min" BETWEEN 0 AND 10080);

ALTER TABLE "app"."services"
  ADD CONSTRAINT "services_duration_range" CHECK ("duration_min" BETWEEN 5 AND 720),
  ADD CONSTRAINT "services_price_range" CHECK ("price_minor" BETWEEN 0 AND 100000000),
  ADD CONSTRAINT "services_buffers_range" CHECK ("buffer_before_min" BETWEEN 0 AND 120 AND "buffer_after_min" BETWEEN 0 AND 120),
  ADD CONSTRAINT "services_max_advance" CHECK ("max_advance_days" IS NULL OR "max_advance_days" BETWEEN 1 AND 365),
  ADD CONSTRAINT "services_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "app"."availability_rules"
  ADD CONSTRAINT "availability_rules_day" CHECK ("day_of_week" BETWEEN 1 AND 7),
  ADD CONSTRAINT "availability_rules_window" CHECK ("start_min" >= 0 AND "end_min" <= 1440 AND "end_min" > "start_min");

ALTER TABLE "app"."availability_exceptions"
  ADD CONSTRAINT "availability_exceptions_dates" CHECK ("end_date" IS NULL OR "end_date" >= "date"),
  ADD CONSTRAINT "availability_exceptions_window" CHECK (
    ("type" = 'CLOSED' AND "start_min" IS NULL AND "end_min" IS NULL)
    OR ("type" IN ('CUSTOM_HOURS', 'BLOCK')
        AND "end_date" IS NULL
        AND "start_min" IS NOT NULL AND "end_min" IS NOT NULL
        AND "start_min" >= 0 AND "end_min" <= 1440 AND "end_min" > "start_min")
  );

ALTER TABLE "app"."customers"
  ADD CONSTRAINT "customers_phone_e164" CHECK ("phone_e164" IS NULL OR "phone_e164" ~ '^\+[1-9][0-9]{6,14}$');

ALTER TABLE "app"."appointments"
  ADD CONSTRAINT "appointments_interval_valid" CHECK ("end_at" > "start_at"),
  ADD CONSTRAINT "appointments_duration_matches" CHECK ("end_at" = "start_at" + make_interval(mins => "duration_min")),
  ADD CONSTRAINT "appointments_block_contains" CHECK ("block_start_at" <= "start_at" AND "block_end_at" >= "end_at"),
  ADD CONSTRAINT "appointments_price_nonneg" CHECK ("quoted_price_minor" >= 0),
  ADD CONSTRAINT "appointments_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "appointments_cancel_consistent" CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL)),
  ADD CONSTRAINT "appointments_complete_consistent" CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL)),
  ADD CONSTRAINT "appointments_noshow_consistent" CHECK (("status" = 'NO_SHOW') = ("no_show_at" IS NOT NULL));

ALTER TABLE "app"."payment_records"
  ADD CONSTRAINT "payment_records_amount_positive" CHECK ("amount_minor" > 0 AND "amount_minor" <= 100000000),
  ADD CONSTRAINT "payment_records_void_consistent" CHECK (("voided_at" IS NULL) = ("voided_by_user_id" IS NULL));

ALTER TABLE "app"."rate_limit_buckets"
  ADD CONSTRAINT "rate_limit_buckets_count_nonneg" CHECK ("count" >= 0);

-- 4. Human-facing appointment numbers start at A-10240 (matches the design).
ALTER SEQUENCE "app"."appointments_ref_number_seq" RESTART WITH 10240;

-- 5. Supporting indexes -------------------------------------------------------
-- Phone-limit check: active appointments per customer.
CREATE INDEX "appointments_active_by_customer"
  ON "app"."appointments" ("tenant_id", "customer_id", "end_at")
  WHERE "status" IN ('PENDING', 'CONFIRMED');

-- Collected-revenue aggregation over live (non-voided) records.
CREATE INDEX "payment_records_live_by_tenant"
  ON "app"."payment_records" ("tenant_id", "recorded_at")
  WHERE "voided_at" IS NULL;

-- 6. Access control -----------------------------------------------------------
-- The `app` schema is not in Supabase's exposed Data API schemas. As defence
-- in depth, strip any access the Supabase API roles might have and enable RLS
-- (deny by default). Only the least-privilege runtime role `tempo_app` gets a
-- permissive policy. The table owner (migration role) bypasses RLS.
REVOKE ALL ON SCHEMA "app" FROM PUBLIC;

DO $$
DECLARE
  r text;
  t text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA app FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA app FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM %I', r);
    END IF;
  END LOOP;

  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- Grants for the runtime role. Idempotent; also run by prisma/sql/roles.sql
-- (for when the role is created after migrations). Re-run after adding tables.
CREATE OR REPLACE FUNCTION "app"."tempo_apply_grants"() RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tempo_app') THEN
    RAISE NOTICE 'role tempo_app does not exist yet; skipping grants';
    RETURN;
  END IF;

  GRANT USAGE ON SCHEMA app TO tempo_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO tempo_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO tempo_app;

  -- Append-only audit trail and payment ledger.
  REVOKE UPDATE, DELETE, TRUNCATE ON app.audit_logs FROM tempo_app;
  REVOKE DELETE, TRUNCATE ON app.payment_records FROM tempo_app;
  -- Appointments and customers are never hard-deleted by the app.
  REVOKE DELETE, TRUNCATE ON app.appointments, app.customers, app.tenants, app.users FROM tempo_app;
  -- The runtime never touches migration bookkeeping.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'app' AND tablename = '_prisma_migrations') THEN
    REVOKE ALL ON app._prisma_migrations FROM tempo_app;
  END IF;

  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('DROP POLICY IF EXISTS tempo_app_access ON app.%I', t);
    EXECUTE format('CREATE POLICY tempo_app_access ON app.%I FOR ALL TO tempo_app USING (true) WITH CHECK (true)', t);
  END LOOP;
END
$fn$;

REVOKE ALL ON FUNCTION "app"."tempo_apply_grants"() FROM PUBLIC;

SELECT "app"."tempo_apply_grants"();
