'use server';

import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { requireTenant } from '@/lib/auth/authorize';
import { can } from '@/lib/auth/permissions';
import { formatPhone } from '@/lib/phone';
import { parseInput, uuidSchema } from '@/lib/validation';
import { daySlots } from '@/modules/scheduling/availability';
import { loadScheduleData } from '@/modules/scheduling/load';
import { LOCAL_DATE_RE } from '@/modules/scheduling/time';
import { netCollectedMinor } from '@/modules/payments/ledger';
import { appointmentRef } from './rules';
import type { AppointmentDetails } from './types';
import { msg } from '@/i18n/message-ref';

/** Appointment details for the drawer (tenant-scoped; permissions computed server-side). */
export async function getAppointmentDetailsAction(
  tenantSlug: string,
  appointmentId: string,
): Promise<ActionResult<AppointmentDetails>> {
  return runAction('getAppointmentDetails', async () => {
    const ctx = await requireTenant(tenantSlug, 'appointments.read');
    const id = parseInput(uuidSchema, appointmentId);
    const db = getDb();
    const a = await db.appointment.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        staff: { select: { displayName: true } },
        customer: { select: { id: true, phoneE164: true, createdAt: true } },
        payments: { orderBy: { recordedAt: 'asc' } },
      },
    });
    if (!a) throw new AppError('NOT_FOUND', msg('appointmentNotFound'));
    const completedVisits = await db.appointment.count({
      where: { tenantId: ctx.tenantId, customerId: a.customerId, status: 'COMPLETED' },
    });
    const own = ctx.staffId !== null && ctx.staffId === a.staffId;
    return {
      id: a.id,
      ref: appointmentRef(a.refNumber),
      status: a.status,
      source: a.source,
      serviceId: a.serviceId,
      serviceName: a.serviceNameSnapshot,
      staffId: a.staffId,
      staffName: a.staff.displayName,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      durationMin: a.durationMin,
      quotedPriceMinor: a.quotedPriceMinor,
      currency: a.currency,
      customerId: a.customer.id,
      contactName: a.contactName,
      contactEmail: a.contactEmail,
      phone: formatPhone(a.customer.phoneE164),
      customerNote: a.customerNote,
      internalNote: a.internalNote,
      cancelReason: a.cancelReason,
      completedVisits,
      customerSince: a.customer.createdAt.toISOString(),
      payments: a.payments.map((p) => ({
        id: p.id,
        kind: p.kind,
        amountMinor: p.amountMinor,
        method: p.method,
        recordedAt: p.recordedAt.toISOString(),
        voided: p.voidedAt !== null,
        note: p.note,
      })),
      collectedMinor: netCollectedMinor(a.payments),
      can: {
        manage:
          can(ctx.role, 'appointments.manage.any') ||
          (own && can(ctx.role, 'appointments.manage.own')),
        pay: can(ctx.role, 'payments.record.any') || (own && can(ctx.role, 'payments.record.own')),
        void: can(ctx.role, 'payments.void'),
        rebook: can(ctx.role, 'appointments.create'),
      },
    };
  });
}

const optionsSchema = z.object({
  appointmentId: uuidSchema,
  date: z.string().regex(LOCAL_DATE_RE),
});

/** Start times (15-minute grid) for moving an appointment, ignoring its own block. */
export async function rescheduleOptionsAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ startMin: number; available: boolean }[]>> {
  return runAction('rescheduleOptions', async () => {
    const ctx = await requireTenant(tenantSlug, 'appointments.read');
    const input = parseInput(optionsSchema, raw);
    const db = getDb();
    const a = await db.appointment.findFirst({
      where: { id: input.appointmentId, tenantId: ctx.tenantId },
      include: { service: true },
    });
    if (!a) throw new AppError('NOT_FOUND', msg('appointmentNotFound'));
    const policy = await db.bookingPolicy.findUniqueOrThrow({ where: { tenantId: ctx.tenantId } });
    const data = await loadScheduleData(db, {
      tenantId: ctx.tenantId,
      tz: ctx.timezone,
      fromDate: input.date,
      toDate: input.date,
      staffIds: [a.staffId],
    });
    const res = daySlots(data, {
      date: input.date,
      staffIds: [a.staffId],
      service: { ...a.service, durationMin: a.durationMin },
      policy: { ...policy, slotIntervalMin: 15 },
      nowMs: Date.now(),
      mode: 'staff',
      excludeAppointmentId: a.id,
    });
    return res.slots.map((s) => ({ startMin: s.startMin, available: s.available }));
  });
}
