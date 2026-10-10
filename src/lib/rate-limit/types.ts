export interface RateLimitStore {
  /** Atomically increment the counter for (key, window) and return the new count. */
  increment(key: string, windowStart: Date, windowSec: number): Promise<number>;
}
