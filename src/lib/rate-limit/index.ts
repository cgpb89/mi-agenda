import 'server-only';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { hmacHex } from '@/lib/security/tokens';
import { logger } from '@/lib/observability/logger';
import { MemoryRateLimitStore } from './memory';
import { PostgresRateLimitStore } from './postgres';
import type { RateLimitStore } from './types';
import { msg } from '@/i18n/message-ref';

/**
 * Fixed-window limits. Keys are HMACed before storage so raw IPs, emails and
 * phone numbers never reach the rate-limit table.
 */
export const LIMITS = {
  loginByIp: { limit: 30, windowSec: 15 * 60 },
  loginByAccount: { limit: 8, windowSec: 15 * 60 },
  signupByIp: { limit: 6, windowSec: 60 * 60 },
  resetByIp: { limit: 6, windowSec: 60 * 60 },
  resetByAccount: { limit: 3, windowSec: 60 * 60 },
  slotsByIp: { limit: 120, windowSec: 60 },
  bookingByIp: { limit: 10, windowSec: 10 * 60 },
  bookingByPhone: { limit: 6, windowSec: 60 * 60 },
  bookingByTenant: { limit: 300, windowSec: 10 * 60 },
  manageByIp: { limit: 30, windowSec: 10 * 60 },
  manageByToken: { limit: 10, windowSec: 10 * 60 },
  inviteByTenant: { limit: 20, windowSec: 60 * 60 },
  dashboardWriteByUser: { limit: 600, windowSec: 10 * 60 },
  photoUploadByTenant: { limit: 30, windowSec: 60 * 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

let store: RateLimitStore | undefined;

export function getRateLimitStore(): RateLimitStore {
  if (!store) {
    const env = getEnv();
    store =
      env.RATE_LIMIT_STORE === 'memory' ? new MemoryRateLimitStore() : new PostgresRateLimitStore();
  }
  return store;
}

/** Test hook. */
export function setRateLimitStoreForTests(s: RateLimitStore | undefined) {
  store = s;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export async function checkRateLimit(
  name: LimitName,
  ...keyParts: string[]
): Promise<RateLimitResult> {
  const { limit, windowSec } = LIMITS[name];
  const key = hmacHex(getEnv().RATE_LIMIT_SECRET, `${name}|${keyParts.join('|')}`);
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSec * 1000)) * windowSec * 1000;
  const count = await getRateLimitStore().increment(key, new Date(windowStart), windowSec);
  const retryAfterSec = Math.max(1, Math.ceil((windowStart + windowSec * 1000 - now) / 1000));
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec };
}

/** Throws RATE_LIMITED when the limit is exceeded. */
export async function enforceRateLimit(name: LimitName, ...keyParts: string[]): Promise<void> {
  const res = await checkRateLimit(name, ...keyParts);
  if (!res.allowed) {
    logger.warn('rate limit exceeded', { limit: name });
    throw new AppError('RATE_LIMITED', msg('rateLimited'), {
      retryAfterSec: res.retryAfterSec,
    });
  }
}
