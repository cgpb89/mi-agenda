-- Platform-admin support mode: the store a support session is acting on.
-- Bound to the admin's own session row (not a cookie), cleared on exit.
ALTER TABLE "app"."sessions" ADD COLUMN "support_tenant_id" UUID;

ALTER TABLE "app"."sessions"
  ADD CONSTRAINT "sessions_support_tenant_id_fkey" FOREIGN KEY ("support_tenant_id")
  REFERENCES "app"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
