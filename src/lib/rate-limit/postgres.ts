import 'server-only';
import { getDb } from '@/lib/db/client';
import type { RateLimitStore } from './types';

/**
 * Shared fixed-window counters in PostgreSQL (`app.rate_limit_buckets`).
 * One atomic upsert per check; works across any number of app instances and
 * with the transaction pooler. Expired rows are swept opportunistically.
 */
export class PostgresRateLimitStore implements RateLimitStore {
  async increment(key: string, windowStart: Date, windowSec: number): Promise<number> {
    const db = getDb();
    const expiresAt = new Date(windowStart.getTime() + windowSec * 1000);
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO app.rate_limit_buckets (key, window_start, count, expires_at)
      VALUES (${key}, ${windowStart}, 1, ${expiresAt})
      ON CONFLICT (key, window_start)
      DO UPDATE SET count = app.rate_limit_buckets.count + 1
      RETURNING count`;
    if (Math.random() < 0.01) {
      // Bounded storage: purge expired windows (cheap, indexed on expires_at).
      void db.$executeRaw`DELETE FROM app.rate_limit_buckets WHERE expires_at < now() - interval '1 hour'`.catch(
        () => {},
      );
    }
    return Number(rows[0]?.count ?? 1);
  }
}
