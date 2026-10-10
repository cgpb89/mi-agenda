import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { getEnv } from '@/lib/env';

export type Db = PrismaClient;

export function createPrismaClient(connectionString: string, max = 5): PrismaClient {
  // No statementNameGenerator → pg uses unnamed prepared statements, which is
  // compatible with Supabase's transaction pooler (Supavisor, port 6543).
  const adapter = new PrismaPg(
    {
      connectionString,
      max,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      application_name: 'tempo',
    },
    { schema: 'app' },
  );
  return new PrismaClient({ adapter });
}

const globalForDb = globalThis as unknown as { __tempoDb?: PrismaClient };

/** Process-wide client (reused across hot reloads in development). */
export function getDb(): PrismaClient {
  if (!globalForDb.__tempoDb) {
    const env = getEnv();
    globalForDb.__tempoDb = createPrismaClient(env.DATABASE_URL, env.DATABASE_POOL_MAX);
  }
  return globalForDb.__tempoDb;
}
