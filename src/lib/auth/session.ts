import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { getDb } from '@/lib/db/client';
import type { Tx } from '@/lib/db/tx';
import { getEnv } from '@/lib/env';
import { generateToken, hmacHex } from '@/lib/security/tokens';

export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TOUCH_INTERVAL_MS = 60 * 60 * 1000; // refresh lastUsedAt at most hourly

export function sessionCookieName(): string {
  // __Host- prefix: Secure, Path=/, no Domain — cannot be set by subdomains.
  return getEnv().NODE_ENV === 'production' ? '__Host-tempo_session' : 'tempo_session';
}

export function hashSessionToken(token: string): string {
  return hmacHex(getEnv().SESSION_SECRET, `session:${token}`);
}

/** Create a session row and return the raw token (only ever sent in the cookie). */
export async function createSessionRecord(
  userId: string,
  userAgent: string | null,
  db: Tx | ReturnType<typeof getDb> = getDb(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_MS);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      userAgent: userAgent?.slice(0, 256) ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(sessionCookieName());
}

/**
 * Start a fresh session (rotation): any session token presented with this
 * request is revoked first, which prevents session fixation.
 */
export async function startSession(userId: string): Promise<void> {
  const jar = await cookies();
  const existing = jar.get(sessionCookieName())?.value;
  if (existing) {
    await getDb().session.deleteMany({ where: { tokenHash: hashSessionToken(existing) } });
  }
  const ua = (await headers()).get('user-agent');
  const { token, expiresAt } = await createSessionRecord(userId, ua);
  await setSessionCookie(token, expiresAt);
}

export interface SessionUser {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  platformRole: 'NONE' | 'ADMIN';
  /** Platform admins in support mode: the store this session acts on. */
  supportTenantId: string | null;
}

/** Validate the request's session cookie. Memoised per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (!token || token.length > 128) return null;
  return validateSessionToken(token);
});

export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  const db = getDb();
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: { select: { id: true, email: true, name: true, status: true, platformRole: true } },
    },
  });
  if (!session) return null;
  const now = Date.now();
  const expired =
    session.expiresAt.getTime() <= now || session.lastUsedAt.getTime() + SESSION_IDLE_MS <= now;
  if (expired || session.user.status !== 'ACTIVE') {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (now - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date(now) } })
      .catch(() => {});
  }
  return {
    sessionId: session.id,
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    platformRole: session.user.platformRole,
    supportTenantId: session.user.platformRole === 'ADMIN' ? session.supportTenantId : null,
  };
}

export async function revokeCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) await getDb().session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  await clearSessionCookie();
}

/** Revoke every session of the given users (password change, suspension, role change). */
export async function revokeAllSessions(
  userIds: string[],
  db: Tx | ReturnType<typeof getDb> = getDb(),
): Promise<void> {
  if (userIds.length === 0) return;
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
}
