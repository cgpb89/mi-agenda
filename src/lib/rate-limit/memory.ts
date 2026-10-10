import type { RateLimitStore } from './types';

/**
 * In-process store. DEVELOPMENT/TESTS ONLY: counters are per-process, so with
 * several instances (or serverless) limits would multiply. `getEnv()` refuses
 * this store when NODE_ENV=production.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();
  private readonly maxEntries: number;

  constructor(maxEntries = 50_000) {
    this.maxEntries = maxEntries;
  }

  async increment(key: string, windowStart: Date, windowSec: number): Promise<number> {
    const now = Date.now();
    const id = `${key}:${windowStart.getTime()}`;
    const existing = this.buckets.get(id);
    if (existing && existing.expiresAt > now) {
      existing.count += 1;
      return existing.count;
    }
    if (this.buckets.size >= this.maxEntries) this.sweep(now);
    this.buckets.set(id, { count: 1, expiresAt: windowStart.getTime() + windowSec * 1000 });
    return 1;
  }

  private sweep(now: number) {
    for (const [k, v] of this.buckets) if (v.expiresAt <= now) this.buckets.delete(k);
    // Bounded memory even under key-flooding: drop oldest half if still full.
    if (this.buckets.size >= this.maxEntries) {
      let i = 0;
      const half = this.maxEntries / 2;
      for (const k of this.buckets.keys()) {
        if (i++ > half) break;
        this.buckets.delete(k);
      }
    }
  }
}
