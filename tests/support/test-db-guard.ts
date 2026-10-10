/**
 * Safety gate for every test that touches PostgreSQL. Tests TRUNCATE tables,
 * so they must never run against a development or production database.
 *
 * Required (put them in .env.test.local, never in .env):
 *   TEST_DATABASE_URL          runtime URL of a SEPARATE test database/project
 *   TEST_DIRECT_URL            direct/session URL of the same test database
 *   ALLOW_DESTRUCTIVE_DB_TESTS=true
 *   TEST_DB_PROJECT_ALLOWLIST  comma-separated Supabase project refs or hostnames
 *
 * The gate also refuses when the test database is the same as DATABASE_URL /
 * DIRECT_URL from .env (the dev/prod database).
 */
import { config } from 'dotenv';

export interface TestDbConfig {
  databaseUrl: string;
  directUrl: string;
}

function identity(url: string): { host: string; user: string; db: string; ref: string } {
  const u = new URL(url);
  const user = decodeURIComponent(u.username);
  // Supavisor usernames look like "role.<project-ref>"; direct hosts like db.<ref>.supabase.co
  const refFromUser = user.includes('.') ? user.split('.').pop()! : '';
  const refFromHost = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(u.hostname)?.[1] ?? '';
  return {
    host: u.hostname,
    user,
    db: u.pathname.slice(1),
    ref: refFromUser || refFromHost || u.hostname,
  };
}

export function loadTestDbConfig(): TestDbConfig {
  // .env holds dev values (for the comparison below); .env.test.local the test DB.
  const devEnv = config({ path: '.env', quiet: true }).parsed ?? {};
  config({ path: '.env.test.local', override: true, quiet: true });

  const fail = (msg: string): never => {
    throw new Error(
      `[test-db-guard] ${msg}\nIntegration/e2e tests need a separate, allow-listed test database. See README → Testing.`,
    );
  };

  const databaseUrl = process.env.TEST_DATABASE_URL;
  const directUrl = process.env.TEST_DIRECT_URL;
  if (!databaseUrl || !directUrl)
    fail('TEST_DATABASE_URL and TEST_DIRECT_URL must be set (in .env.test.local).');
  if (process.env.ALLOW_DESTRUCTIVE_DB_TESTS !== 'true')
    fail('Set ALLOW_DESTRUCTIVE_DB_TESTS=true to confirm this database may be wiped.');
  if (process.env.NODE_ENV === 'production') fail('NODE_ENV=production.');

  const allow = (process.env.TEST_DB_PROJECT_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length === 0) fail('TEST_DB_PROJECT_ALLOWLIST is empty.');

  for (const url of [databaseUrl!, directUrl!]) {
    const id = identity(url);
    if (!allow.includes(id.ref) && !allow.includes(id.host))
      fail(`Database "${id.ref}" is not in TEST_DB_PROJECT_ALLOWLIST.`);
    for (const devUrl of [devEnv.DATABASE_URL, devEnv.DIRECT_URL].filter(Boolean) as string[]) {
      const dev = identity(devUrl);
      if (dev.ref === id.ref && dev.db === id.db)
        fail('The test database is the same as the one in .env (DATABASE_URL/DIRECT_URL).');
    }
  }
  return { databaseUrl: databaseUrl!, directUrl: directUrl! };
}

/** Point the app's runtime config at the test database with test-only secrets. */
export function applyTestEnv(cfg: TestDbConfig): void {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = 'test';
  env.DATABASE_URL = cfg.databaseUrl;
  env.DIRECT_URL = cfg.directUrl;
  env.DATABASE_POOL_MAX = env.TEST_DATABASE_POOL_MAX ?? '10';
  env.APP_URL = env.TEST_APP_URL ?? 'http://localhost:3100';
  env.SESSION_SECRET = 'test-session-secret-0123456789-abcdefghijklmnop';
  env.PASSWORD_RESET_TOKEN_SECRET = 'test-token-secret-0123456789-abcdefghijklmnop';
  env.RATE_LIMIT_SECRET = 'test-ratelimit-secret-0123456789-abcdefghijklm';
  env.RATE_LIMIT_STORE = 'postgres';
  env.EMAIL_FROM = '';
  env.EMAIL_SERVER_HOST = '';
}
