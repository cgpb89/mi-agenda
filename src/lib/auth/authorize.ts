import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb } from '@/lib/db/client';
import { AppError } from '@/lib/errors';
import { getSessionUser, type SessionUser } from './session';
import { can, type MembershipRole, type Permission } from './permissions';
import { isClosed } from '@/modules/billing/access';
import type { PlanKey } from '@/modules/plans/features';
import { msg } from '@/i18n/message-ref';

/**
 * Everything a tenant-scoped operation is allowed to rely on. It is derived on
 * the server from the session + membership — never from client input. Every
 * repository call takes this and filters by `tenantId`.
 */
export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  timezone: string;
  currency: string;
  country: string;
  locale: string;
  /** Tenant status (TRIAL / ACTIVE) and end of the trial or paid period. */
  status: string;
  accessUntil: Date;
  /** Subscription plan; what it includes comes from modules/plans. */
  plan: PlanKey;
  role: MembershipRole;
  userId: string;
  /** Staff profile of the current user in this tenant, if any. */
  staffId: string | null;
  user: SessionUser;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError('UNAUTHENTICATED', msg('signInToContinue'));
  return user;
}

const SLUG_SHAPE = /^[a-z0-9-]{1,48}$/;

/**
 * Resolve the active membership for `tenantSlug`. Unknown tenant, no
 * membership, suspended membership and suspended tenant all produce the same
 * NOT_FOUND so tenant existence is not revealed to non-members.
 */
export const getTenantContext = cache(async (tenantSlug: string): Promise<TenantContext> => {
  const user = await requireUser();
  if (!SLUG_SHAPE.test(tenantSlug)) throw new AppError('NOT_FOUND', msg('businessNotFound'));
  const membership = await getDb().membership.findFirst({
    where: {
      userId: user.userId,
      status: 'ACTIVE',
      tenant: { slug: tenantSlug, status: { in: ['TRIAL', 'ACTIVE'] } },
    },
    include: {
      tenant: true,
    },
  });
  if (!membership) throw new AppError('NOT_FOUND', msg('businessNotFound'));
  const staff = await getDb().staff.findFirst({
    where: { tenantId: membership.tenantId, userId: user.userId },
    select: { id: true },
  });
  const t = membership.tenant;
  return {
    tenantId: t.id,
    tenantSlug: t.slug,
    tenantName: t.name,
    timezone: t.timezone,
    currency: t.currency,
    country: t.country,
    locale: t.locale,
    status: t.status,
    accessUntil: t.accessUntil,
    plan: t.plan,
    role: membership.role,
    userId: user.userId,
    staffId: staff?.id ?? null,
    user,
  };
});

/**
 * For server actions / route handlers: throws AppError on failure. A closed
 * store (trial or paid period over) can't change anything until it pays.
 */
export async function requireTenant(
  tenantSlug: string,
  permission: Permission = 'dashboard.view',
): Promise<TenantContext> {
  const ctx = await getTenantContext(tenantSlug);
  assertCan(ctx, permission);
  if (isClosed(ctx.accessUntil)) throw new AppError('POLICY', msg('storeClosed'));
  return ctx;
}

export function assertCan(ctx: Pick<TenantContext, 'role'>, permission: Permission): void {
  if (!can(ctx.role, permission)) {
    throw new AppError('FORBIDDEN', msg('noAccess'));
  }
}

/**
 * For "own vs any" permissions on a staff-assigned record, e.g. a STAFF member
 * may only complete appointments assigned to their own staff profile.
 */
export function assertCanManageAssigned(
  ctx: Pick<TenantContext, 'role' | 'staffId'>,
  anyPermission: Permission,
  ownPermission: Permission,
  assignedStaffId: string,
): void {
  if (can(ctx.role, anyPermission)) return;
  if (can(ctx.role, ownPermission) && ctx.staffId !== null && ctx.staffId === assignedStaffId)
    return;
  throw new AppError('FORBIDDEN', msg('noAccess'));
}

/** For pages: redirect to login / render 404 instead of throwing. */
export async function requireTenantPage(
  tenantSlug: string,
  permission: Permission = 'dashboard.view',
): Promise<TenantContext> {
  try {
    // Closed stores still render pages: the tenant layout swaps in the
    // "store closed" screen, and every action stays blocked by requireTenant.
    const ctx = await getTenantContext(tenantSlug);
    assertCan(ctx, permission);
    return ctx;
  } catch (err) {
    if (err instanceof AppError) {
      if (err.code === 'UNAUTHENTICATED')
        redirect(`/login?next=${encodeURIComponent(`/app/${tenantSlug}`)}`);
      if (err.code === 'FORBIDDEN') redirect(`/app/${tenantSlug}/overview?denied=1`);
      notFound();
    }
    throw err;
  }
}

export async function requireUserPage(nextPath = '/app'): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/**
 * Platform administrators. This grants access to /super-admin ONLY; it does not
 * make the user a member of any tenant and gives no customer-data access.
 */
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.platformRole !== 'ADMIN') throw new AppError('NOT_FOUND', msg('notFound'));
  return user;
}

export async function requirePlatformAdminPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=%2Fsuper-admin');
  if (user.platformRole !== 'ADMIN') notFound();
  return user;
}
