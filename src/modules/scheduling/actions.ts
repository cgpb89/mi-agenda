'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withTransaction } from '@/lib/db/tx';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { requireTenant } from '@/lib/auth/authorize';
import { enforceRateLimit } from '@/lib/rate-limit';
import { optionalTextSchema, parseInput, timeZoneSchema, uuidSchema } from '@/lib/validation';
import { audit } from '@/modules/audit/audit';
import { validateDayPeriods } from './intervals';
import { localDateToDb } from './load';
import { LOCAL_DATE_RE } from './time';
import { msg } from '@/i18n/message-ref';

const period = z.object({
  start: z.number().int().min(0).max(1440),
  end: z.number().int().min(0).max(1440),
});
const week = z.record(z.enum(['1', '2', '3', '4', '5', '6', '7']), z.array(period).max(6));

const saveSchema = z.object({
  business: week,
  /** staffId → weekly schedule, or null to follow business hours. */
  staff: z.record(uuidSchema, week.nullable()),
  rules: z.object({
    slotIntervalMin: z.union([z.literal(15), z.literal(30), z.literal(60)]),
    minNoticeMin: z.union([
      z.literal(0),
      z.literal(60),
      z.literal(120),
      z.literal(240),
      z.literal(1440),
    ]),
    maxAdvanceDays: z.union([z.literal(14), z.literal(30), z.literal(60), z.literal(90)]),
    timezone: timeZoneSchema,
  }),
});

function checkWeek(w: z.infer<typeof week>, schedule: 'business' | 'staff') {
  for (const [dow, periods] of Object.entries(w)) {
    const err = validateDayPeriods(periods);
    if (err) {
      throw new AppError(
        'VALIDATION',
        msg('invalidPeriods', { schedule, overlap: err === 'overlap', day: Number(dow) }),
      );
    }
  }
}

function rows(tenantId: string, staffId: string | null, w: z.infer<typeof week>) {
  return Object.entries(w).flatMap(([dow, periods]) =>
    periods.map((p) => ({
      tenantId,
      staffId,
      dayOfWeek: Number(dow),
      startMin: p.start,
      endMin: p.end,
    })),
  );
}

/** Replace weekly hours (business + staff) and booking rules atomically. */
export async function saveAvailabilityAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('saveAvailability', async () => {
    const ctx = await requireTenant(tenantSlug, 'availability.manage');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const input = parseInput(saveSchema, raw);
    checkWeek(input.business, 'business');
    await withTransaction(async (tx) => {
      const staffIds = Object.keys(input.staff);
      const owned = await tx.staff.count({
        where: { tenantId: ctx.tenantId, id: { in: staffIds }, deletedAt: null },
      });
      if (owned !== staffIds.length) throw new AppError('VALIDATION', msg('unknownStaff'));
      for (const w of Object.values(input.staff)) if (w) checkWeek(w, 'staff');

      await tx.availabilityRule.deleteMany({
        where: { tenantId: ctx.tenantId, OR: [{ staffId: null }, { staffId: { in: staffIds } }] },
      });
      const data = [
        ...rows(ctx.tenantId, null, input.business),
        ...Object.entries(input.staff).flatMap(([id, w]) => (w ? rows(ctx.tenantId, id, w) : [])),
      ];
      if (data.length) await tx.availabilityRule.createMany({ data });
      await tx.bookingPolicy.update({
        where: { tenantId: ctx.tenantId },
        data: {
          slotIntervalMin: input.rules.slotIntervalMin,
          minNoticeMin: input.rules.minNoticeMin,
          maxAdvanceDays: input.rules.maxAdvanceDays,
          updatedByUserId: ctx.userId,
        },
      });
      if (input.rules.timezone !== ctx.timezone) {
        await tx.tenant.update({
          where: { id: ctx.tenantId },
          data: { timezone: input.rules.timezone },
        });
      }
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'availability.updated',
          targetType: 'tenant',
          targetId: ctx.tenantId,
          metadata: {
            rules: input.rules,
            staffCustomised: Object.values(input.staff).filter(Boolean).length,
          },
        },
        tx,
      );
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return undefined;
  });
}

const exceptionSchema = z
  .object({
    staffId: uuidSchema.nullable(),
    type: z.enum(['CLOSED', 'CUSTOM_HOURS', 'BLOCK']),
    date: z.string().regex(LOCAL_DATE_RE, msg('pickDate')),
    endDate: z.string().regex(LOCAL_DATE_RE).optional().or(z.literal('')),
    startMin: z.number().int().min(0).max(1440).optional(),
    endMin: z.number().int().min(0).max(1440).optional(),
    reason: optionalTextSchema(120),
  })
  .superRefine((v, c) => {
    if (
      v.type !== 'CLOSED' &&
      (v.startMin === undefined || v.endMin === undefined || v.endMin <= v.startMin)
    ) {
      c.addIssue({
        code: 'custom',
        path: ['endMin'],
        message: msg('endAfterStart'),
      });
    }
    if (v.endDate && v.endDate < v.date)
      c.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: msg('endDateAfterStart'),
      });
  });

export async function addExceptionAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction('addException', async () => {
    const ctx = await requireTenant(tenantSlug, 'availability.manage');
    const input = parseInput(exceptionSchema, raw);
    const id = await withTransaction(async (tx) => {
      if (input.staffId) {
        const s = await tx.staff.findFirst({
          where: { id: input.staffId, tenantId: ctx.tenantId },
          select: { id: true },
        });
        if (!s) throw new AppError('VALIDATION', msg('unknownStaff'));
      }
      const ex = await tx.availabilityException.create({
        data: {
          tenantId: ctx.tenantId,
          staffId: input.staffId,
          type: input.type,
          date: localDateToDb(input.date),
          endDate: input.type === 'CLOSED' && input.endDate ? localDateToDb(input.endDate) : null,
          startMin: input.type === 'CLOSED' ? null : input.startMin!,
          endMin: input.type === 'CLOSED' ? null : input.endMin!,
          reason: input.reason ?? null,
          createdByUserId: ctx.userId,
        },
      });
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'availability.exception_added',
          targetType: 'exception',
          targetId: ex.id,
          metadata: { type: input.type, date: input.date },
        },
        tx,
      );
      return ex.id;
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return { id };
  });
}

export async function removeExceptionAction(
  tenantSlug: string,
  id: string,
): Promise<ActionResult<undefined>> {
  return runAction('removeException', async () => {
    const ctx = await requireTenant(tenantSlug, 'availability.manage');
    const exId = parseInput(uuidSchema, id);
    await withTransaction(async (tx) => {
      const res = await tx.availabilityException.deleteMany({
        where: { id: exId, tenantId: ctx.tenantId },
      });
      if (res.count !== 1) throw new AppError('NOT_FOUND', msg('overrideNotFound'));
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'availability.exception_removed',
          targetType: 'exception',
          targetId: exId,
        },
        tx,
      );
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return undefined;
  });
}
