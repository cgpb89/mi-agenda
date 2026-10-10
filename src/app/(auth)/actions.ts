'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { AppError, type PublicError, toPublicError } from '@/lib/errors';
import { startSession, revokeCurrentSession, getSessionUser } from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { clientIp, safeRedirectPath } from '@/lib/security/request';
import { formToObject, parseInput } from '@/lib/validation';
import { audit } from '@/modules/audit/audit';
import { forgotSchema, loginSchema, resetSchema, signupSchema } from '@/modules/auth/schemas';
import {
  authenticate,
  registerOwner,
  requestPasswordReset,
  resetPassword,
} from '@/modules/auth/service';

export interface FormState {
  error?: PublicError;
  done?: boolean;
  values?: Record<string, string>;
}

/** Strip secrets before echoing values back into the form. */
function echo(values: Record<string, string>): Record<string, string> {
  const { password: _p, confirm: _c, token: _t, ...rest } = values;
  return rest;
}

async function landingFor(userId: string, platformRole: string): Promise<string> {
  const m = await getDb().membership.findFirst({
    where: { userId, status: 'ACTIVE', tenant: { status: { in: ['TRIAL', 'ACTIVE'] } } },
    orderBy: { createdAt: 'asc' },
    select: { tenant: { select: { slug: true } } },
  });
  if (m) return `/app/${m.tenant.slug}/overview`;
  if (platformRole === 'ADMIN') return '/super-admin';
  return '/app';
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = formToObject(form);
  let target: string;
  try {
    const ip = await clientIp();
    await enforceRateLimit('loginByIp', ip);
    const input = parseInput(loginSchema, values);
    await enforceRateLimit('loginByAccount', input.email);
    const { userId, platformRole } = await authenticate(input.email, input.password);
    await startSession(userId);
    const next = values.next ? safeRedirectPath(values.next, '') : '';
    target = next || (await landingFor(userId, platformRole));
  } catch (err) {
    return { error: toPublicError(err, 'login'), values: echo(values) };
  }
  redirect(target);
}

export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = formToObject(form);
  let slug: string;
  try {
    await enforceRateLimit('signupByIp', await clientIp());
    const input = parseInput(signupSchema, values);
    const res = await registerOwner(input);
    await startSession(res.userId);
    slug = res.tenantSlug;
  } catch (err) {
    return { error: toPublicError(err, 'signup'), values: echo(values) };
  }
  redirect(`/app/${slug}/onboarding`);
}

export async function forgotPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = formToObject(form);
  try {
    const ip = await clientIp();
    await enforceRateLimit('resetByIp', ip);
    const input = parseInput(forgotSchema, values);
    await enforceRateLimit('resetByAccount', input.email);
    await requestPasswordReset(input.email);
    // Same response whether or not the account exists.
    return { done: true };
  } catch (err) {
    if (err instanceof AppError && err.code === 'VALIDATION')
      return { error: toPublicError(err), values: echo(values) };
    if (err instanceof AppError && err.code === 'RATE_LIMITED')
      return { error: toPublicError(err), values: echo(values) };
    // Never reveal other failures (e.g. mail errors) — respond as success.
    toPublicError(err, 'forgot-password');
    return { done: true };
  }
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = formToObject(form);
  try {
    await enforceRateLimit('resetByIp', await clientIp());
    const input = parseInput(resetSchema, values);
    await resetPassword(input.token, input.password);
  } catch (err) {
    return { error: toPublicError(err, 'reset-password') };
  }
  redirect('/login?reset=1');
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  await revokeCurrentSession();
  if (user) {
    await audit({
      actorUserId: user.userId,
      actorType: 'user',
      action: 'user.logout',
      targetType: 'user',
      targetId: user.userId,
    });
  }
  redirect('/login');
}
