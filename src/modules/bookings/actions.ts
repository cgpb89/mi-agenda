'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { assertCanManageAssigned, requireTenant } from '@/lib/auth/authorize';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  nameSchema,
  optionalEmailSchema,
  optionalTextSchema,
  parseInput,
  uuidSchema,
} from '@/lib/validation';
import { formatPhone } from '@/lib/phone';
import { LOCAL_DATE_RE } from '@/modules/scheduling/time';
import { createAppointment, rescheduleAppointment } from './engine';
import { transitionAppointment } from './lifecycle';
import { checkStaffSlot, type SlotCheck } from './staff-check';
import { appointmentRef } from './rules';
import { msg } from '@/i18n/message-ref';
import { getLocale } from '@/i18n/server';

/*
 * Dashboard appointment actions. Every action:
 *  1. resolves the tenant from the session membership (requireTenant), never
 *     from a client-supplied tenant id;
 *  2. checks the role permission (and "own vs any" for STAFF);
 *  3. validates input with zod;
 *  4. delegates to the shared booking engine / lifecycle module.
 */

const slotSchema = z.object({
  serviceId: uuidSchema,
  staffId: uuidSchema,
  date: z.string().regex(LOCAL_DATE_RE),
  startMin: z.coerce.number().int().min(0).max(1439),
  excludeAppointmentId: uuidSchema.optional(),
});

export async function checkSlotAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<SlotCheck>> {
  return runAction('checkSlot', async () => {
    const ctx = await requireTenant(tenantSlug, 'appointments.read');
    const input = parseInput(slotSchema, raw);
    return checkStaffSlot({
      tenantId: ctx.tenantId,
      tz: ctx.timezone,
      businessName: ctx.tenantName,
      locale: await getLocale(),
      ...input,
    });
  });
}

const createSchema = z.object({
  serviceId: uuidSchema,
  staffId: uuidSchema,
  date: z.string().regex(LOCAL_DATE_RE),
  startMin: z.coerce.number().int().min(0).max(1439),
  customerId: uuidSchema.optional(),
  customerName: z.string().optional(),
  phone: z.string().max(32).optional(),
  phoneCountry: z.string().length(2).optional(),
  email: optionalEmailSchema,
  notes: optionalTextSchema(1000, true),
  source: z.enum(['PHONE', 'WALK_IN']).default('PHONE'),
});

export async function createAppointmentAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; ref: string }>> {
  return runAction('createAppointment', async () => {
    const ctx = await requireTenant(tenantSlug, 'appointments.create');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const input = parseInput(createSchema, raw);
    // STAFF may only book into their own column.
    if (ctx.role === 'STAFF' && input.staffId !== ctx.staffId) {
      throw new AppError('FORBIDDEN', msg('ownCalendarOnly'));
    }
    let name = '';
    if (!input.customerId) {
      name = parseInput(z.object({ n: nameSchema('customerName') }), {
        n: input.customerName ?? '',
      }).n;
    }
    const created = await createAppointment({
      tenantId: ctx.tenantId,
      mode: 'staff',
      serviceId: input.serviceId,
      staffId: input.staffId,
      date: input.date,
      startMin: input.startMin,
      customer: {
        existingCustomerId: input.customerId,
        name,
        phoneRaw: input.phone || undefined,
        phoneCountry: input.phoneCountry ?? ctx.country,
        email: input.email,
      },
      internalNote: input.notes,
      source: input.source,
      actorUserId: ctx.userId,
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return { id: created.id, ref: appointmentRef(created.refNumber) };
  });
}

export async function searchCustomersAction(
  tenantSlug: string,
  query: string,
): Promise<ActionResult<{ id: string; name: string; phone: string }[]>> {
  return runAction('searchCustomers', async () => {
    const ctx = await requireTenant(tenantSlug, 'customers.read');
    const q = String(query ?? '')
      .trim()
      .slice(0, 60);
    const digits = q.replace(/\D/g, '');
    const rows = await getDb().customer.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                ...(digits.length >= 3 ? [{ phoneE164: { contains: digits } }] : []),
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 20,
      select: { id: true, name: true, phoneE164: true },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, phone: formatPhone(r.phoneE164) }));
  });
}

const transitionSchema = z.object({
  appointmentId: uuidSchema,
  action: z.enum(['confirm', 'cancel', 'complete', 'no_show']),
  reason: optionalTextSchema(200),
});

export async function transitionAppointmentAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ status: string }>> {
  return runAction('transitionAppointment', async () => {
    const ctx = await requireTenant(tenantSlug, 'appointments.read');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const input = parseInput(transitionSchema, raw);
    const updated = await transitionAppointment({
      tenantId: ctx.tenantId,
      appointmentId: input.appointmentId,
      action: input.action,
      actorType: 'user',
      actorUserId: ctx.userId,
      reason: input.reason,
      guard: (appt) =>
        assertCanManageAssigned(
          ctx,
          'appointments.manage.any',
          'appointments.manage.own',
          appt.staffId,
        ),
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return { status: updated.status };
  });
}

const rescheduleSchema = z.object({
  appointmentId: uuidSchema,
  date: z.string().regex(LOCAL_DATE_RE),
  startMin: z.coerce.number().int().min(0).max(1439),
});

export async function rescheduleAppointmentAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ startAt: string }>> {
  return runAction('rescheduleAppointment', async () => {
    const ctx = await requireTenant(tenantSlug, 'appointments.read');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const input = parseInput(rescheduleSchema, raw);
    const appt = await getDb().appointment.findFirst({
      where: { id: input.appointmentId, tenantId: ctx.tenantId },
      select: { staffId: true },
    });
    if (!appt) throw new AppError('NOT_FOUND', msg('appointmentNotFound'));
    assertCanManageAssigned(
      ctx,
      'appointments.manage.any',
      'appointments.manage.own',
      appt.staffId,
    );
    const updated = await rescheduleAppointment({
      tenantId: ctx.tenantId,
      appointmentId: input.appointmentId,
      date: input.date,
      startMin: input.startMin,
      mode: 'staff',
      actorUserId: ctx.userId,
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return { startAt: updated.startAt.toISOString() };
  });
}
