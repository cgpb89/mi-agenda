-- SINPE Móvil deposits (plan feature `sinpeDeposits`). The business sets a
-- fixed or percentage deposit and its SINPE number; the customer pays and types
-- the SINPE reference when booking; staff confirm it, which records a payment
-- and confirms the appointment. Unverified deposits expire after 24 hours.
ALTER TYPE "app"."PaymentMethod" ADD VALUE IF NOT EXISTS 'SINPE';

ALTER TABLE "app"."booking_policies"
  ADD COLUMN "deposit_mode" VARCHAR(8) NOT NULL DEFAULT 'NONE',
  ADD COLUMN "deposit_value" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sinpe_phone" VARCHAR(32),
  ADD COLUMN "sinpe_name" VARCHAR(120),
  ADD CONSTRAINT "booking_policies_deposit_mode" CHECK ("deposit_mode" IN ('NONE', 'FIXED', 'PERCENT')),
  ADD CONSTRAINT "booking_policies_deposit_value" CHECK (
    ("deposit_mode" = 'NONE')
    OR ("deposit_mode" = 'FIXED' AND "deposit_value" BETWEEN 1 AND 100000000)
    OR ("deposit_mode" = 'PERCENT' AND "deposit_value" BETWEEN 1 AND 100)
  );

ALTER TABLE "app"."appointments"
  ADD COLUMN "deposit_minor" INTEGER,
  ADD COLUMN "deposit_reference" VARCHAR(40),
  ADD COLUMN "deposit_status" VARCHAR(10),
  ADD CONSTRAINT "appointments_deposit_status" CHECK (
    "deposit_status" IS NULL OR "deposit_status" IN ('AWAITING', 'CONFIRMED', 'REJECTED', 'EXPIRED')
  ),
  ADD CONSTRAINT "appointments_deposit_amount" CHECK ("deposit_minor" IS NULL OR "deposit_minor" > 0);

-- The hourly job finds deposits still waiting for verification.
CREATE INDEX "appointments_deposit_awaiting_idx" ON "app"."appointments" ("created_at")
  WHERE "deposit_status" = 'AWAITING';
