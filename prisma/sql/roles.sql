-- ─────────────────────────────────────────────────────────────────────────────
-- One-time setup of the least-privilege runtime role `tempo_app`.
-- Run in the Supabase SQL editor (as `postgres`) for EACH project (dev, test,
-- prod) — before or after `prisma migrate deploy`; it is idempotent.
--
-- 1. Replace the password below with a long random value (do not commit it).
-- 2. Runtime DATABASE_URL then uses this role through the pooler, e.g.
--    postgresql://tempo_app.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
-- 3. Migrations (DIRECT_URL) keep using the `postgres` (owner) role.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tempo_app') THEN
    CREATE ROLE tempo_app LOGIN PASSWORD 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

-- Runtime queries are bounded; long-running statements indicate a bug or abuse.
ALTER ROLE tempo_app SET statement_timeout = '15s';
ALTER ROLE tempo_app SET idle_in_transaction_session_timeout = '30s';
-- Extension types/operators (btree_gist) live in `extensions` on Supabase.
ALTER ROLE tempo_app SET search_path = app, extensions, public;

-- Apply table grants + RLS policy (no-op until migrations have created `app`).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'app' AND p.proname = 'tempo_apply_grants') THEN
    PERFORM app.tempo_apply_grants();
  END IF;
END
$$;
