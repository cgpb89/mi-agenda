import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getDb } from './client';
import { isRetryableTxError } from './errors';

export type Tx = Prisma.TransactionClient;

export interface TxOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /** Retries for serialization failures / deadlocks (not for business errors). */
  retries?: number;
  timeoutMs?: number;
}

/**
 * Interactive transaction with bounded retry on transient concurrency errors.
 * Business-rule errors (AppError) and constraint violations are NOT retried.
 */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
  opts: TxOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  let attempt = 0;
  for (;;) {
    try {
      return await getDb().$transaction(fn, {
        isolationLevel: opts.isolationLevel ?? 'ReadCommitted',
        maxWait: 5_000,
        timeout: opts.timeoutMs ?? 10_000,
      });
    } catch (err) {
      if (attempt < retries && isRetryableTxError(err)) {
        attempt += 1;
        const backoff = 20 * 2 ** attempt + Math.floor(Math.random() * 25);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw err;
    }
  }
}
