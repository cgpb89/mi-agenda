import { beforeEach, describe, expect, it } from 'vitest';
import { generateToken } from '@/lib/security/tokens';
import { validateSessionToken, hashSessionToken, SESSION_IDLE_MS } from '@/lib/auth/session';
import {
  authenticate,
  registerOwner,
  requestPasswordReset,
  resetPassword,
  resetTokenHash,
} from '@/modules/auth/service';
import { checkRateLimit, enforceRateLimit } from '@/lib/rate-limit';
import { AppError } from '@/lib/errors';
import { adminDb, resetDb } from './factories';

const PW = 'correct horse battery staple';

async function register(email = 'owner@example.test', slug = 'auth-biz') {
  return registerOwner({
    name: 'Owner',
    email,
    password: PW,
    businessName: 'Auth Biz',
    slug,
    category: 'SERVICES',
    timezone: 'Europe/Madrid',
    country: 'ES',
  });
}

beforeEach(resetDb);

describe('registration', () => {
  it('creates user, tenant, owner membership, profile, policy and staff in one transaction', async () => {
    const { userId, tenantSlug } = await register();
    const db = adminDb();
    const t = await db.tenant.findUniqueOrThrow({
      where: { slug: tenantSlug },
      include: { profile: true, policy: true, memberships: true, staff: true },
    });
    expect(t.memberships).toEqual([expect.objectContaining({ userId, role: 'OWNER' })]);
    expect(t.profile?.pageStatus).toBe('DRAFT');
    expect(t.policy?.maxActiveAppointmentsPerPhone).toBeGreaterThanOrEqual(1);
    expect(t.currency).toBe('EUR');
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
    expect(u.passwordHash).not.toContain(PW);
  });

  it('is all-or-nothing: a taken slug leaves no orphan user', async () => {
    await register('a@example.test', 'taken-slug');
    await expect(register('b@example.test', 'taken-slug')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(await adminDb().user.findUnique({ where: { email: 'b@example.test' } })).toBeNull();
  });

  it('enforces unique normalised email', async () => {
    await register('dup@example.test', 'dup-1');
    await expect(register('dup@example.test', 'dup-2')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('login', () => {
  it('accepts correct credentials and rejects others with one generic message', async () => {
    await register();
    await expect(authenticate('owner@example.test', PW)).resolves.toBeTruthy();
    const wrong = await authenticate('owner@example.test', 'nope').catch((e: AppError) => e);
    const unknown = await authenticate('nobody@example.test', PW).catch((e: AppError) => e);
    expect((wrong as AppError).message).toBe((unknown as AppError).message);
    expect((wrong as AppError).code).toBe('UNAUTHENTICATED');
  });

  it('suspended users cannot sign in', async () => {
    const { userId } = await register();
    await adminDb().user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    await expect(authenticate('owner@example.test', PW)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});

describe('sessions', () => {
  it('stores only a hash of the token and validates it server-side', async () => {
    const { userId } = await register();
    const token = generateToken();
    await adminDb().session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    expect(await adminDb().session.count({ where: { tokenHash: token } })).toBe(0);
    expect(await validateSessionToken(token)).toMatchObject({ userId });
    expect(await validateSessionToken(generateToken())).toBeNull();
  });

  it('expires by absolute and idle timeout, and dies with suspension', async () => {
    const { userId } = await register();
    const t1 = generateToken();
    await adminDb().session.create({
      data: { userId, tokenHash: hashSessionToken(t1), expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await validateSessionToken(t1)).toBeNull();
    const t2 = generateToken();
    await adminDb().session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(t2),
        expiresAt: new Date(Date.now() + 3600_000),
        lastUsedAt: new Date(Date.now() - SESSION_IDLE_MS - 1000),
      },
    });
    expect(await validateSessionToken(t2)).toBeNull();
    const t3 = generateToken();
    await adminDb().session.create({
      data: { userId, tokenHash: hashSessionToken(t3), expiresAt: new Date(Date.now() + 3600_000) },
    });
    await adminDb().user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    expect(await validateSessionToken(t3)).toBeNull();
  });
});

describe('password reset', () => {
  async function issueToken(userId: string, ttlMs = 30 * 60_000) {
    const token = generateToken();
    await adminDb().passwordResetToken.create({
      data: { userId, tokenHash: resetTokenHash(token), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return token;
  }

  it('is single-use, revokes all sessions and changes the password', async () => {
    const { userId } = await register();
    await adminDb().session.create({
      data: { userId, tokenHash: 'a'.repeat(64), expiresAt: new Date(Date.now() + 3600_000) },
    });
    const token = await issueToken(userId);
    await resetPassword(token, 'a brand new password 42');
    expect(await adminDb().session.count({ where: { userId } })).toBe(0);
    await expect(
      authenticate('owner@example.test', 'a brand new password 42'),
    ).resolves.toBeTruthy();
    await expect(resetPassword(token, 'another new password 43')).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('rejects expired tokens and concurrent reuse', async () => {
    const { userId } = await register();
    const expired = await issueToken(userId, -1000);
    await expect(resetPassword(expired, 'a brand new password 42')).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    const token = await issueToken(userId);
    const results = await Promise.allSettled([
      resetPassword(token, 'first new password 111'),
      resetPassword(token, 'second new password 222'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('a new request invalidates older links and never reveals whether the account exists', async () => {
    const { userId } = await register();
    await expect(requestPasswordReset('nobody@example.test')).resolves.toBeUndefined();
    await requestPasswordReset('owner@example.test');
    await requestPasswordReset('owner@example.test');
    expect(await adminDb().passwordResetToken.count({ where: { userId, consumedAt: null } })).toBe(
      1,
    );
  });
});

describe('rate limiting (shared PostgreSQL store)', () => {
  it('blocks after the limit within a window and keys are hashed', async () => {
    for (let i = 0; i < 8; i++) await enforceRateLimit('loginByAccount', 'victim@example.test');
    await expect(enforceRateLimit('loginByAccount', 'victim@example.test')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    // Other keys are unaffected.
    expect((await checkRateLimit('loginByAccount', 'someone-else@example.test')).allowed).toBe(
      true,
    );
    const rows = await adminDb().rateLimitBucket.findMany();
    expect(rows.every((r) => !r.key.includes('@'))).toBe(true);
  });

  it('holds under concurrent attempts', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => checkRateLimit('loginByAccount', 'burst@example.test')),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(8);
  });
});
