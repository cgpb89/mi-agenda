-- Deleting a service or staff member keeps the row (past appointments reference
-- it) but hides it from the dashboard. A deleted row is always inactive.
ALTER TABLE "app"."services" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
ALTER TABLE "app"."staff" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

ALTER TABLE "app"."services"
  ADD CONSTRAINT "services_deleted_inactive" CHECK ("deleted_at" IS NULL OR ("is_active" = false AND "is_online" = false));
ALTER TABLE "app"."staff"
  ADD CONSTRAINT "staff_deleted_inactive" CHECK ("deleted_at" IS NULL OR "is_active" = false);
