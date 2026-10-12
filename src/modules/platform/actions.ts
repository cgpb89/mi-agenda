'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { requirePlatformAdmin } from '@/lib/auth/authorize';
import { revokeAllSessions } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { withTransaction } from '@/lib/db/tx';
import { parseInput, uuidSchema } from '@/lib/validation';
import { audit } from '@/modules/audit/audit';
import { extendAccess } from '@/modules/billing/access';
import { FEATURE_KEYS, MAX_PHOTOS_CEILING, PLAN_KEYS } from '@/modules/plans/features';
import type { Prisma } from '@/generated/prisma/client';
import { msg } from '@/i18n/message-ref';

/*
 * Platform administration. These actions manage ACCOUNTS (tenant status, plan,
 * user access) and never read or change a tenant's customer data.
 * Every change requires a reason (where the design asks for one) and is audited.
 */

const reason = z.string().trim().min(3, msg('addReason')).max(300);

const tenantStatusSchema = z.object({
  tenantId: uuidSchema,
  action: z.enum(['suspend', 'reactivate']),
  reason,
});

export async function setTenantStatusAction(raw: unknown): Promise<ActionResult<{ name: string }>> {
  return runAction('platform.setTenantStatus', async () => {
    const admin = await requirePlatformAdmin();
    const input = parseInput(tenantStatusSchema, raw);
    const res = await withTransaction(async (tx) => {
      const t = await tx.tenant.findUnique({
        where: { id: input.tenantId },
        select: { id: true, name: true, status: true, plan: true },
      });
      if (!t) throw new AppError('NOT_FOUND', msg('businessNotFound'));
      if (input.action === 'suspend') {
        if (t.status === 'SUSPENDED') throw new AppError('CONFLICT', msg('alreadySuspended'));
        await tx.tenant.update({
          where: { id: t.id },
          data: { status: 'SUSPENDED', suspendedAt: new Date() },
        });
        // Booking page goes offline (status check) and members are signed out.
        const members = await tx.membership.findMany({
          where: { tenantId: t.id },
          select: { userId: true },
        });
        await revokeAllSessions(
          members.map((m) => m.userId),
          tx,
        );
      } else {
        if (t.status !== 'SUSPENDED') throw new AppError('CONFLICT', msg('notSuspended'));
        await tx.tenant.update({
          where: { id: t.id },
          data: { status: t.plan === 'TRIAL' ? 'TRIAL' : 'ACTIVE', suspendedAt: null },
        });
      }
      await audit(
        {
          tenantId: t.id,
          actorUserId: admin.userId,
          actorType: 'user',
          action: input.action === 'suspend' ? 'tenant.suspended' : 'tenant.reactivated',
          targetType: 'tenant',
          targetId: t.id,
          metadata: { reason: input.reason, name: t.name },
        },
        tx,
      );
      return { name: t.name };
    });
    revalidatePath('/super-admin', 'layout');
    return res;
  });
}

const planSchema = z.object({
  tenantId: uuidSchema,
  plan: z.enum(['TRIAL', 'STARTER', 'GROWTH', 'BUSINESS']),
  reason,
});

export async function changePlanAction(raw: unknown): Promise<ActionResult<{ plan: string }>> {
  return runAction('platform.changePlan', async () => {
    const admin = await requirePlatformAdmin();
    const input = parseInput(planSchema, raw);
    await withTransaction(async (tx) => {
      const t = await tx.tenant.findUnique({
        where: { id: input.tenantId },
        select: { id: true, name: true, plan: true, status: true },
      });
      if (!t) throw new AppError('NOT_FOUND', msg('businessNotFound'));
      if (t.plan === input.plan) throw new AppError('CONFLICT', msg('alreadyCurrentPlan'));
      await tx.tenant.update({
        where: { id: t.id },
        data: {
          plan: input.plan,
          // Leaving trial makes an active trial account a paying (active) one.
          ...(t.status === 'TRIAL' && input.plan !== 'TRIAL' ? { status: 'ACTIVE' as const } : {}),
        },
      });
      await audit(
        {
          tenantId: t.id,
          actorUserId: admin.userId,
          actorType: 'user',
          action: 'tenant.plan_changed',
          targetType: 'tenant',
          targetId: t.id,
          metadata: { from: t.plan, to: input.plan, reason: input.reason, name: t.name },
        },
        tx,
      );
    });
    revalidatePath('/super-admin', 'layout');
    return { plan: input.plan };
  });
}

const paymentSchema = z.object({
  tenantId: uuidSchema,
  months: z.union([z.literal(1), z.literal(12)]),
  /** Payment reference, e.g. a SINPE Móvil or transfer number. */
  reason,
});

/**
 * Record a plan payment received outside the app (SINPE, transfer…). Extends
 * the store's access by 1 or 12 months — from today if it was already closed —
 * which reopens a closed store and ends a trial.
 */
export async function recordPaymentAction(
  raw: unknown,
): Promise<ActionResult<{ accessUntil: string }>> {
  return runAction('platform.recordPayment', async () => {
    const admin = await requirePlatformAdmin();
    const input = parseInput(paymentSchema, raw);
    const accessUntil = await withTransaction(async (tx) => {
      const t = await tx.tenant.findUnique({
        where: { id: input.tenantId },
        select: { id: true, name: true, status: true, accessUntil: true },
      });
      if (!t) throw new AppError('NOT_FOUND', msg('businessNotFound'));
      const next = extendAccess(t.accessUntil, input.months);
      await tx.tenant.update({
        where: { id: t.id },
        data: {
          accessUntil: next,
          // New period: owner warnings can go out again before it ends.
          notifiedEndingAt: null,
          notifiedClosedAt: null,
          notifiedDeletionAt: null,
          ...(t.status === 'TRIAL' ? { status: 'ACTIVE' as const } : {}),
        },
      });
      await audit(
        {
          tenantId: t.id,
          actorUserId: admin.userId,
          actorType: 'user',
          action: 'tenant.payment_recorded',
          targetType: 'tenant',
          targetId: t.id,
          metadata: {
            months: input.months,
            from: t.accessUntil.toISOString(),
            to: next.toISOString(),
            reference: input.reason,
            name: t.name,
          },
        },
        tx,
      );
      return next;
    });
    revalidatePath('/super-admin', 'layout');
    return { accessUntil: accessUntil.toISOString() };
  });
}

const planSettingsSchema = z.object({
  plans: z
    .array(
      z.object({
        plan: z.enum(PLAN_KEYS),
        priceCrcMinor: z.number().int().min(0).max(100_000_000),
        priceUsdMinor: z.number().int().min(0).max(1_000_000),
        staffLimit: z.number().int().min(1).max(1000).nullable(),
        photoLimit: z.number().int().min(0).max(MAX_PHOTOS_CEILING),
        features: z.array(z.enum(FEATURE_KEYS)).max(FEATURE_KEYS.length),
      }),
    )
    .min(1)
    .max(PLAN_KEYS.length),
});

/**
 * Save what each plan includes (Super-admin → Plans). Takes effect on the next
 * request for every business on that plan; existing data is never deleted
 * (e.g. extra photos are hidden, not removed, when a limit goes down).
 */
export async function savePlanSettingsAction(raw: unknown): Promise<ActionResult<undefined>> {
  return runAction('platform.savePlanSettings', async () => {
    const admin = await requirePlatformAdmin();
    const { plans } = parseInput(planSettingsSchema, raw);
    await withTransaction(async (tx) => {
      for (const p of plans) {
        const before = await tx.planSettings.findUnique({ where: { plan: p.plan } });
        const data = {
          priceCrcMinor: p.priceCrcMinor,
          priceUsdMinor: p.priceUsdMinor,
          staffLimit: p.staffLimit,
          photoLimit: p.photoLimit,
          features: [...new Set(p.features)] as Prisma.InputJsonValue,
          updatedByUserId: admin.userId,
        };
        await tx.planSettings.upsert({
          where: { plan: p.plan },
          create: { plan: p.plan, ...data },
          update: data,
        });
        await audit(
          {
            actorUserId: admin.userId,
            actorType: 'user',
            action: 'plan.updated',
            targetType: 'plan',
            targetId: p.plan,
            metadata: {
              plan: p.plan,
              from: before
                ? {
                    priceCrcMinor: before.priceCrcMinor,
                    priceUsdMinor: before.priceUsdMinor,
                    staffLimit: before.staffLimit,
                    photoLimit: before.photoLimit,
                    features: before.features,
                  }
                : null,
              to: { ...data, updatedByUserId: undefined },
            },
          },
          tx,
        );
      }
    });
    revalidatePath('/', 'layout');
    return undefined;
  });
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const platformSettingsSchema = z.object({
  supportEmail: z.union([z.literal(''), z.email(msg('enterEmail'))]).transform((v) => v || null),
  supportWhatsapp: optional(32),
  sinpePhone: optional(32),
  sinpeName: optional(120),
  paymentNote: optional(600),
});

/** Payment instructions and support contacts shown to business owners. */
export async function savePlatformSettingsAction(raw: unknown): Promise<ActionResult<undefined>> {
  return runAction('platform.saveSettings', async () => {
    const admin = await requirePlatformAdmin();
    const input = parseInput(platformSettingsSchema, raw);
    await withTransaction(async (tx) => {
      await tx.platformSettings.upsert({
        where: { id: 1 },
        create: { id: 1, ...input, updatedByUserId: admin.userId },
        update: { ...input, updatedByUserId: admin.userId },
      });
      await audit(
        {
          actorUserId: admin.userId,
          actorType: 'user',
          action: 'platform.settings_updated',
          targetType: 'platform',
          metadata: input,
        },
        tx,
      );
    });
    revalidatePath('/', 'layout');
    return undefined;
  });
}

const userStatusSchema = z.object({
  userId: uuidSchema,
  action: z.enum(['suspend', 'reactivate']),
  reason: reason.optional(),
});

export async function setUserStatusAction(raw: unknown): Promise<ActionResult<{ name: string }>> {
  return runAction('platform.setUserStatus', async () => {
    const admin = await requirePlatformAdmin();
    const input = parseInput(userStatusSchema, raw);
    if (input.userId === admin.userId) throw new AppError('POLICY', msg('cantSuspendSelf'));
    const res = await withTransaction(async (tx) => {
      const u = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, platformRole: true },
      });
      if (!u) throw new AppError('NOT_FOUND', msg('userNotFound'));
      if (u.platformRole === 'ADMIN') throw new AppError('POLICY', msg('adminsViaCli'));
      await tx.user.update({
        where: { id: u.id },
        data: { status: input.action === 'suspend' ? 'SUSPENDED' : 'ACTIVE' },
      });
      if (input.action === 'suspend') await revokeAllSessions([u.id], tx);
      await audit(
        {
          actorUserId: admin.userId,
          actorType: 'user',
          action: input.action === 'suspend' ? 'user.suspended' : 'user.reactivated',
          targetType: 'user',
          targetId: u.id,
          metadata: { reason: input.reason, name: u.name },
        },
        tx,
      );
      return { name: u.name };
    });
    revalidatePath('/super-admin', 'layout');
    return res;
  });
}

const roleSchema = z.object({
  membershipId: uuidSchema,
  role: z.enum(['OWNER', 'MANAGER', 'STAFF']),
});

/** Support operation: change a member's role (e.g. ownership transfer). Revokes their sessions. */
export async function platformChangeRoleAction(raw: unknown): Promise<ActionResult<undefined>> {
  return runAction('platform.changeRole', async () => {
    const admin = await requirePlatformAdmin();
    const input = parseInput(roleSchema, raw);
    await withTransaction(async (tx) => {
      const m = await tx.membership.findUnique({
        where: { id: input.membershipId },
        include: { user: { select: { name: true } }, tenant: { select: { name: true } } },
      });
      if (!m) throw new AppError('NOT_FOUND', msg('membershipNotFound'));
      if (m.role === 'OWNER' && input.role !== 'OWNER') {
        const owners = await tx.membership.count({
          where: { tenantId: m.tenantId, role: 'OWNER', status: 'ACTIVE' },
        });
        if (owners <= 1) throw new AppError('POLICY', msg('needsOwner'));
      }
      await tx.membership.update({ where: { id: m.id }, data: { role: input.role } });
      await revokeAllSessions([m.userId], tx);
      await audit(
        {
          tenantId: m.tenantId,
          actorUserId: admin.userId,
          actorType: 'user',
          action: 'membership.role_changed',
          targetType: 'user',
          targetId: m.userId,
          metadata: {
            from: m.role,
            to: input.role,
            by: 'platform',
            user: m.user.name,
            business: m.tenant.name,
          },
        },
        tx,
      );
    });
    revalidatePath('/super-admin', 'layout');
    return undefined;
  });
}

const flagSchema = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/),
  enabled: z.boolean(),
});

export async function toggleFlagAction(raw: unknown): Promise<ActionResult<undefined>> {
  return runAction('platform.toggleFlag', async () => {
    const admin = await requirePlatformAdmin();
    const input = parseInput(flagSchema, raw);
    await withTransaction(async (tx) => {
      const f = await tx.featureFlag.findUnique({ where: { key: input.key } });
      if (!f) throw new AppError('NOT_FOUND', msg('flagNotFound'));
      await tx.featureFlag.update({ where: { key: f.key }, data: { enabled: input.enabled } });
      await audit(
        {
          actorUserId: admin.userId,
          actorType: 'user',
          action: 'feature_flag.toggled',
          targetType: 'feature_flag',
          targetId: f.key,
          metadata: { name: f.name, enabled: input.enabled },
        },
        tx,
      );
    });
    revalidatePath('/super-admin', 'layout');
    return undefined;
  });
}

/**
 * Support mode: open a store's dashboard as its owner to help configure it.
 * Bound to this admin's session; audited on the platform log only.
 */
export async function startSupportAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const tenantId = parseInput(uuidSchema, formData.get('tenantId'));
  const t = await getDb().tenant.findFirst({
    where: { id: tenantId, status: { in: ['TRIAL', 'ACTIVE'] } },
    select: { id: true, slug: true, name: true },
  });
  if (!t) throw new AppError('NOT_FOUND', msg('businessNotFound'));
  await getDb().session.update({
    where: { id: admin.sessionId },
    data: { supportTenantId: t.id },
  });
  await audit({
    actorUserId: admin.userId,
    actorType: 'user',
    action: 'platform.support_started',
    targetType: 'tenant',
    targetId: t.id,
    metadata: { slug: t.slug, name: t.name },
  });
  redirect(`/app/${t.slug}/overview`);
}

export async function stopSupportAction(): Promise<void> {
  const admin = await requirePlatformAdmin();
  if (admin.supportTenantId) {
    await getDb().session.update({
      where: { id: admin.sessionId },
      data: { supportTenantId: null },
    });
    await audit({
      actorUserId: admin.userId,
      actorType: 'user',
      action: 'platform.support_ended',
      targetType: 'tenant',
      targetId: admin.supportTenantId,
    });
  }
  redirect('/super-admin/businesses');
}
