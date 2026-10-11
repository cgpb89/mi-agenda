-- Free trial and paid periods. A new store gets 1 month; when access_until
-- passes the store closes, and one month after that it is deleted.
ALTER TABLE "app"."tenants"
  ADD COLUMN "access_until" TIMESTAMPTZ(3) NOT NULL DEFAULT (now() + '1 mon'::interval);

-- Stores that exist before billing starts are treated as paid for a year.
UPDATE "app"."tenants" SET "access_until" = now() + '1 year'::interval;
UPDATE "app"."tenants" SET "status" = 'ACTIVE' WHERE "status" = 'TRIAL';

CREATE INDEX "tenants_access_until_idx" ON "app"."tenants" ("access_until");

-- Permanently delete a store whose grace month has ended, with everything it
-- owns. The runtime role cannot delete tenants, appointments, customers or
-- audit rows directly; this owner-run function is the only way, and it
-- re-checks the dates itself so it can't be used to delete an open store.
-- Keep the table list in sync with every table that has a tenant_id.
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

REVOKE ALL ON FUNCTION "app"."purge_expired_tenant"(uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tempo_app') THEN
    GRANT EXECUTE ON FUNCTION "app"."purge_expired_tenant"(uuid) TO tempo_app;
  END IF;
END
$$;
