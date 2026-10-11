import 'server-only';
import { getDb } from '@/lib/db/client';
import { isUniqueViolation } from '@/lib/db/errors';
import { withTransaction } from '@/lib/db/tx';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { sendMail } from '@/lib/mail';
import { burnPasswordCheck, hashPassword, needsRehash, verifyPassword } from '@/lib/auth/password';
import { revokeAllSessions } from '@/lib/auth/session';
import { generateToken, hmacHex } from '@/lib/security/tokens';
import { audit } from '@/modules/audit/audit';
import type { SignupInput, Category } from './schemas';
import { msg } from '@/i18n/message-ref';
import { getI18n } from '@/i18n/server';
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from '@/i18n/config';
import { messages } from '@/i18n/messages';

const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function resetTokenHash(token: string): string {
  return hmacHex(getEnv().PASSWORD_RESET_TOKEN_SECRET, `reset:${token}`);
}

export const TEMPLATE_FOR_CATEGORY: Record<Category, Category> = {
  BARBER: 'BARBER',
  WELLNESS: 'WELLNESS',
  CONSULT: 'CONSULT',
  FITNESS: 'FITNESS',
  SERVICES: 'SERVICES',
};

const CURRENCY_FOR_COUNTRY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  MX: 'MXN',
  GB: 'GBP',
  IE: 'EUR',
  ES: 'EUR',
  PT: 'EUR',
  FR: 'EUR',
  DE: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  FI: 'EUR',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  AR: 'ARS',
  BR: 'BRL',
  CL: 'CLP',
  CO: 'COP',
  PE: 'PEN',
  UY: 'UYU',
  VE: 'USD',
  AU: 'AUD',
  NZ: 'NZD',
  IN: 'INR',
  JP: 'JPY',
  SG: 'SGD',
  ZA: 'ZAR',
  AE: 'AED',
  IL: 'ILS',
};

/**
 * Register an owner: user + tenant + OWNER membership + business profile +
 * booking policy + the owner's staff profile + default hours, in ONE
 * transaction (all or nothing).
 */
export async function registerOwner(
  input: SignupInput,
  /** Language the owner signed up in; becomes the booking page's default language. */
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ userId: string; tenantSlug: string }> {
  const passwordHash = await hashPassword(input.password);
  try {
    return await withTransaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      const tenant = await tx.tenant.create({
        data: {
          name: input.businessName,
          slug: input.slug,
          category: input.category,
          timezone: input.timezone,
          country: input.country,
          currency: CURRENCY_FOR_COUNTRY[input.country] ?? 'USD',
          locale: INTL_LOCALE[locale],
          status: 'TRIAL',
          plan: 'TRIAL',
        },
      });
      await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: 'OWNER' } });
      await tx.businessProfile.create({
        data: {
          tenantId: tenant.id,
          displayName: input.businessName,
          template: TEMPLATE_FOR_CATEGORY[input.category],
          pageStatus: 'DRAFT',
        },
      });
      await tx.bookingPolicy.create({ data: { tenantId: tenant.id, updatedByUserId: user.id } });
      await tx.staff.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          displayName: input.name,
          title: messages[locale].defaults.ownerTitle,
        },
      });
      // Sensible default: Mon–Fri 9:00–17:00. Edited during onboarding.
      await tx.availabilityRule.createMany({
        data: [1, 2, 3, 4, 5].map((d) => ({
          tenantId: tenant.id,
          staffId: null,
          dayOfWeek: d,
          startMin: 540,
          endMin: 1020,
        })),
      });
      await audit(
        {
          tenantId: tenant.id,
          actorUserId: user.id,
          actorType: 'user',
          action: 'user.registered',
          targetType: 'user',
          targetId: user.id,
        },
        tx,
      );
      await audit(
        {
          tenantId: tenant.id,
          actorUserId: user.id,
          actorType: 'user',
          action: 'tenant.created',
          targetType: 'tenant',
          targetId: tenant.id,
          metadata: { slug: tenant.slug },
        },
        tx,
      );
      return { userId: user.id, tenantSlug: tenant.slug };
    });
  } catch (err) {
    if (isUniqueViolation(err, 'email')) {
      // Generic enough to not confirm existence beyond what signup inherently reveals.
      throw new AppError('CONFLICT', msg('emailExists'), {
        fieldErrors: { email: msg('emailExistsField') },
      });
    }
    if (isUniqueViolation(err, 'slug')) {
      throw new AppError('CONFLICT', msg('slugTaken'), {
        fieldErrors: { slug: msg('slugTakenField') },
      });
    }
    throw err;
  }
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const t = await getDb().tenant.findUnique({ where: { slug }, select: { id: true } });
  return !t;
}

const INVALID_LOGIN = msg('invalidLogin');

/** Verify credentials. Same message and similar timing for unknown email / wrong password / suspended. */
export async function authenticate(
  email: string,
  password: string,
): Promise<{ userId: string; platformRole: string }> {
  const db = getDb();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await burnPasswordCheck(password);
    throw new AppError('UNAUTHENTICATED', INVALID_LOGIN);
  }
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid || user.status !== 'ACTIVE') {
    await audit({
      actorUserId: user.id,
      actorType: 'user',
      action: 'user.login_failed',
      targetType: 'user',
      targetId: user.id,
    });
    throw new AppError('UNAUTHENTICATED', INVALID_LOGIN);
  }
  const data: { lastLoginAt: Date; passwordHash?: string } = { lastLoginAt: new Date() };
  if (needsRehash(user.passwordHash)) data.passwordHash = await hashPassword(password);
  await db.user.update({ where: { id: user.id }, data });
  await audit({
    actorUserId: user.id,
    actorType: 'user',
    action: 'user.login',
    targetType: 'user',
    targetId: user.id,
  });
  return { userId: user.id, platformRole: user.platformRole };
}

/**
 * Start a password reset. Always succeeds from the caller's perspective (no
 * account enumeration). The raw token is only ever emailed (or, in local
 * development without SMTP, printed to the server console).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const db = getDb();
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') return;
  const token = generateToken(32);
  await withTransaction(async (tx) => {
    // Only the newest link works.
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: resetTokenHash(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    await audit(
      {
        actorUserId: user.id,
        actorType: 'user',
        action: 'user.password_reset_requested',
        targetType: 'user',
        targetId: user.id,
      },
      tx,
    );
  });
  const link = `${getEnv().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const { t } = await getI18n();
  await sendMail({
    to: user.email,
    subject: t.emails.resetSubject,
    text: t.emails.resetBody({ link }),
  });
}

/** Consume a reset token (single use, expiring) and set a new password; revokes all sessions. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await withTransaction(async (tx) => {
    const now = new Date();
    const rec = await tx.passwordResetToken.findUnique({
      where: { tokenHash: resetTokenHash(token) },
    });
    const invalid = new AppError('VALIDATION', msg('resetLinkInvalid'));
    if (!rec || rec.consumedAt || rec.expiresAt <= now) throw invalid;
    // Atomic single-use: only one concurrent request can flip consumedAt.
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: rec.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw invalid;
    await tx.user.update({ where: { id: rec.userId }, data: { passwordHash } });
    await revokeAllSessions([rec.userId], tx);
    await audit(
      {
        actorUserId: rec.userId,
        actorType: 'user',
        action: 'user.password_reset',
        targetType: 'user',
        targetId: rec.userId,
      },
      tx,
    );
  });
}
