-- Email reminders: the customer's language at booking time, and when the
-- 24-hour reminder was sent (set atomically by the hourly reminders job).
ALTER TABLE "app"."appointments"
  ADD COLUMN "locale" VARCHAR(5),
  ADD COLUMN "reminder_sent_at" TIMESTAMPTZ(3);

-- The reminders job scans upcoming, not-yet-reminded appointments by start time.
CREATE INDEX "appointments_reminder_due_idx" ON "app"."appointments" ("start_at")
  WHERE "reminder_sent_at" IS NULL AND "status" IN ('PENDING', 'CONFIRMED');
