import 'server-only';
import { headers } from 'next/headers';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';

/**
 * Client IP for rate limiting. Forwarded headers are only trusted when the
 * deployment declares a proxy that overwrites them (TRUST_PROXY_HEADERS=true);
 * otherwise all requests share one bucket per key type, which fails safe.
 */
export function clientIpFrom(h: Headers): string {
  if (getEnv().TRUST_PROXY_HEADERS) {
    const xff = h.get('x-forwarded-for');
    if (xff) {
      const first = xff.split(',')[0]?.trim();
      if (first) return first.slice(0, 64);
    }
    const real = h.get('x-real-ip');
    if (real) return real.trim().slice(0, 64);
  }
  return 'unknown';
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

/**
 * CSRF defence for cookie-authenticated or state-changing route handlers:
 * require an Origin (or Referer) that matches APP_URL. Server Actions get an
 * equivalent check from Next.js itself.
 */
export function assertSameOrigin(request: Request): void {
  const expected = new URL(getEnv().APP_URL).origin;
  const origin = request.headers.get('origin');
  if (origin) {
    if (origin !== expected) throw new AppError('FORBIDDEN', 'Cross-site request blocked.');
    return;
  }
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      if (new URL(referer).origin === expected) return;
    } catch {
      /* fallthrough */
    }
  }
  throw new AppError('FORBIDDEN', 'Cross-site request blocked.');
}

export { safeRedirectPath } from './redirect';
