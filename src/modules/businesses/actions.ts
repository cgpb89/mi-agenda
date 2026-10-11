'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { withTransaction } from '@/lib/db/tx';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { requireTenant } from '@/lib/auth/authorize';
import { countryCodeSchema } from '@/lib/phone';
import { enforceRateLimit } from '@/lib/rate-limit';
import { nameSchema, optionalEmailSchema, optionalTextSchema, parseInput } from '@/lib/validation';
import { audit } from '@/modules/audit/audit';
import { MAX_ACTIVE_PER_PHONE_MAX, MAX_ACTIVE_PER_PHONE_MIN } from '@/modules/bookings/rules';
import { pageContentSchema, readPageContent } from './page-content';
import { hasFeature } from '@/modules/plans/features';
import { entitlementsFor } from '@/modules/plans/service';
import { msg } from '@/i18n/message-ref';
import { INTL_LOCALE, LOCALES } from '@/i18n/config';

const bookingPageSchema = z.object({
  displayName: nameSchema('businessName', 120),
  tagline: optionalTextSchema(160),
  description: optionalTextSchema(1000, true),
  phone: optionalTextSchema(40),
  email: optionalEmailSchema,
  address: optionalTextSchema(240),
  hoursNote: optionalTextSchema(240),
  template: z.enum(['BARBER', 'WELLNESS', 'CONSULT', 'FITNESS', 'SERVICES']),
  content: pageContentSchema,
  /** Default language of the public booking page. */
  locale: z.enum(LOCALES),
});

export async function saveBookingPageAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('saveBookingPage', async () => {
    const ctx = await requireTenant(tenantSlug, 'bookingPage.manage');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const input = parseInput(bookingPageSchema, raw);
    const plan = await entitlementsFor(ctx.plan);
    await withTransaction(async (tx) => {
      // Brand color and glass are plan features: without them, keep whatever is
      // already stored (it simply isn't shown) instead of accepting changes.
      if (!hasFeature(plan, 'brandColors') || !hasFeature(plan, 'glassStyle')) {
        const current = readPageContent(
          (
            await tx.businessProfile.findUniqueOrThrow({
              where: { tenantId: ctx.tenantId },
              select: { pageContent: true },
            })
          ).pageContent,
        );
        if (!hasFeature(plan, 'brandColors')) input.content.accent = current.accent;
        if (!hasFeature(plan, 'glassStyle')) input.content.style = current.style;
      }
      await tx.businessProfile.update({
        where: { tenantId: ctx.tenantId },
        data: {
          displayName: input.displayName,
          tagline: input.tagline ?? null,
          description: input.description ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          hoursNote: input.hoursNote ?? null,
          template: input.template,
          pageContent: input.content as Prisma.InputJsonValue,
        },
      });
      await tx.tenant.update({
        where: { id: ctx.tenantId },
        data: { locale: INTL_LOCALE[input.locale] },
      });
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'booking_page.updated',
          targetType: 'tenant',
          targetId: ctx.tenantId,
          metadata: { template: input.template, locale: input.locale },
        },
        tx,
      );
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    revalidatePath(`/book/${tenantSlug}`);
    return undefined;
  });
}

export async function setPageStatusAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ status: string }>> {
  return runAction('setPageStatus', async () => {
    const ctx = await requireTenant(tenantSlug, 'bookingPage.manage');
    const { status } = parseInput(z.object({ status: z.enum(['PUBLISHED', 'UNPUBLISHED']) }), raw);
    await withTransaction(async (tx) => {
      if (status === 'PUBLISHED') {
        // Publishing requires something bookable.
        const [services, staffWithServices, hours] = await Promise.all([
          tx.service.count({ where: { tenantId: ctx.tenantId, isActive: true, isOnline: true } }),
          tx.staff.count({
            where: {
              tenantId: ctx.tenantId,
              isActive: true,
              services: { some: { service: { isActive: true, isOnline: true } } },
            },
          }),
          tx.availabilityRule.count({ where: { tenantId: ctx.tenantId, staffId: null } }),
        ]);
        if (!services || !staffWithServices || !hours) {
          throw new AppError('POLICY', msg('publishRequirements'));
        }
      }
      await tx.businessProfile.update({
        where: { tenantId: ctx.tenantId },
        data: { pageStatus: status },
      });
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'booking_page.published',
          targetType: 'tenant',
          targetId: ctx.tenantId,
          metadata: { status },
        },
        tx,
      );
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    revalidatePath(`/book/${tenantSlug}`);
    return { status };
  });
}

const policySchema = z.object({
  maxActiveAppointmentsPerPhone: z.coerce
    .number()
    .int(msg('wholeNumber'))
    .min(MAX_ACTIVE_PER_PHONE_MIN, msg('atLeast', { n: MAX_ACTIVE_PER_PHONE_MIN }))
    .max(MAX_ACTIVE_PER_PHONE_MAX, msg('atMost', { n: MAX_ACTIVE_PER_PHONE_MAX })),
  cancellationWindowMin: z.coerce
    .number()
    .int()
    .refine((v) => [0, 60, 120, 240, 720, 1440, 2880].includes(v), msg('chooseWindow')),
  requireEmail: z.boolean(),
  autoConfirm: z.boolean(),
  policyText: optionalTextSchema(600, true),
});

/** Owner-configured booking policy, including the per-phone active-appointment limit. Audited. */
export async function savePolicyAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('savePolicy', async () => {
    const ctx = await requireTenant(tenantSlug, 'policy.manage');
    const input = parseInput(policySchema, raw);
    await withTransaction(async (tx) => {
      const before = await tx.bookingPolicy.findUniqueOrThrow({
        where: { tenantId: ctx.tenantId },
      });
      await tx.bookingPolicy.update({
        where: { tenantId: ctx.tenantId },
        data: { ...input, policyText: input.policyText ?? null, updatedByUserId: ctx.userId },
      });
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'policy.updated',
          targetType: 'booking_policy',
          targetId: ctx.tenantId,
          metadata: {
            maxActiveAppointmentsPerPhone: {
              from: before.maxActiveAppointmentsPerPhone,
              to: input.maxActiveAppointmentsPerPhone,
            },
            cancellationWindowMin: {
              from: before.cancellationWindowMin,
              to: input.cancellationWindowMin,
            },
            requireEmail: input.requireEmail,
            autoConfirm: input.autoConfirm,
          },
        },
        tx,
      );
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return undefined;
  });
}

const businessSchema = z.object({
  name: nameSchema('businessName', 120),
  country: countryCodeSchema,
  category: z.enum(['BARBER', 'WELLNESS', 'CONSULT', 'FITNESS', 'SERVICES']),
});

export async function saveBusinessAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('saveBusiness', async () => {
    const ctx = await requireTenant(tenantSlug, 'business.manage');
    const input = parseInput(businessSchema, raw);
    await withTransaction(async (tx) => {
      await tx.tenant.update({ where: { id: ctx.tenantId }, data: input });
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'tenant.updated',
          targetType: 'tenant',
          targetId: ctx.tenantId,
          metadata: input,
        },
        tx,
      );
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return undefined;
  });
}
