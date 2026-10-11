-- Waitlist (plan feature `waitlist`): customers leave their email for a full
-- day; when a slot frees up everyone waiting is emailed and the first to book
-- wins. One entry per email, service and day.
CREATE TABLE "app"."waitlist_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "staff_id" UUID,
    "date" DATE NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "locale" VARCHAR(5),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    "notified_at" TIMESTAMPTZ(3),
    "fulfilled_at" TIMESTAMPTZ(3),

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "app"."waitlist_entries"
  ADD CONSTRAINT "waitlist_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "app"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "waitlist_entries_service_fkey" FOREIGN KEY ("tenant_id", "service_id")
    REFERENCES "app"."services"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "waitlist_entries_staff_fkey" FOREIGN KEY ("tenant_id", "staff_id")
    REFERENCES "app"."staff"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "waitlist_entries_email_normalised" CHECK ("email" = lower(btrim("email")));

CREATE UNIQUE INDEX "waitlist_entries_unique" ON "app"."waitlist_entries" ("tenant_id", "service_id", "date", "email");
CREATE INDEX "waitlist_entries_tenant_date_idx" ON "app"."waitlist_entries" ("tenant_id", "date");

ALTER TABLE "app"."waitlist_entries" ENABLE ROW LEVEL SECURITY;
SELECT "app"."tempo_apply_grants"();

-- Keep the store purge complete: it must delete every row that has a tenant_id.
CREATE OR REPLACE FUNCTION "app"."purge_expired_tenant"(p_tenant_id uuid) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, pg_temp
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app.tenants
    WHERE id = p_tenant_id AND access_until + '1 mon'::interval <= now()
  ) THEN
    RETURN false;
  END IF;

  DELETE FROM app.waitlist_entries WHERE tenant_id = p_tenant_id;
  DELETE FROM app.payment_records WHERE tenant_id = p_tenant_id;
  DELETE FROM app.appointments WHERE tenant_id = p_tenant_id;
  DELETE FROM app.customers WHERE tenant_id = p_tenant_id;
  DELETE FROM app.staff_services WHERE tenant_id = p_tenant_id;
  DELETE FROM app.availability_exceptions WHERE tenant_id = p_tenant_id;
  DELETE FROM app.availability_rules WHERE tenant_id = p_tenant_id;
  DELETE FROM app.staff WHERE tenant_id = p_tenant_id;
  DELETE FROM app.services WHERE tenant_id = p_tenant_id;
  DELETE FROM app.booking_policies WHERE tenant_id = p_tenant_id;
  DELETE FROM app.business_profiles WHERE tenant_id = p_tenant_id;
  DELETE FROM app.invitations WHERE tenant_id = p_tenant_id;
  DELETE FROM app.memberships WHERE tenant_id = p_tenant_id;
  DELETE FROM app.audit_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM app.tenants WHERE id = p_tenant_id;
  RETURN true;
END
$fn$;
