/**
 * Recreate the TEST database from the migration history (proves migrations
 * build a clean schema) and re-apply runtime-role grants.
 *
 *   npm run db:test:reset
 *
 * Guarded: only runs against an allow-listed, separate test database.
 */
import { execSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { loadTestDbConfig } from '../tests/support/test-db-guard';

const cfg = loadTestDbConfig();
const env = { ...process.env, DIRECT_URL: cfg.directUrl, DATABASE_URL: cfg.databaseUrl };

console.log('Resetting the test database from prisma/migrations …');
execSync('npx prisma migrate reset --force', { stdio: 'inherit', env });

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: cfg.directUrl, max: 1 }, { schema: 'app' }),
});
db.$executeRawUnsafe('SELECT app.tempo_apply_grants()')
  .then(() => console.log('Grants applied. Test database ready.'))
  .catch((e) => {
    console.error('Applying grants failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
