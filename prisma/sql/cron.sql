-- ─────────────────────────────────────────────────────────────────────────────
-- Tempo: hourly jobs scheduled by Supabase (pg_cron + pg_net).
-- Vercel's free plan only runs crons once a day, so the hourly reminders job is
-- triggered from the database. Run this ONCE in the Supabase SQL editor of the
-- production project, after replacing the two placeholders. Not a migration:
-- test databases don't have these extensions or secrets.
--
--   <APP_URL>      e.g. https://mi-agenda-pearl.vercel.app   (no trailing slash)
--   <CRON_SECRET>  the same value as the CRON_SECRET env var in Vercel
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Keep the secret in Supabase Vault (encrypted), not in the job definition.
SELECT vault.create_secret('<CRON_SECRET>', 'tempo_cron_secret');
SELECT vault.create_secret('<APP_URL>', 'tempo_app_url');

-- Every hour at minute 5: email reminders (and, later, deposit expiry).
SELECT cron.schedule(
  'tempo-reminders',
  '5 * * * *',
  $$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'tempo_app_url')
           || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'tempo_cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- Check it:     SELECT * FROM cron.job;
-- Last runs:    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- HTTP results: SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
-- Remove it:    SELECT cron.unschedule('tempo-reminders');
-- Rotate the secret: SELECT vault.update_secret(id, '<NEW>') FROM vault.secrets WHERE name = 'tempo_cron_secret';
