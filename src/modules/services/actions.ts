'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withTransaction } from '@/lib/db/tx';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { requireTenant } from '@/lib/auth/authorize';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  moneyInputSchema,
  nameSchema,
  optionalTextSchema,
  parseInput,
  uuidSchema,
} from '@/lib/validation';
import { audit } from '@/modules/audit/audit';
import { DURATIONS } from './constants';

const serviceSchema = z.object({
  id: uuidSchema.optional(),
  name: nameSchema('service name', 80),
  description: optionalTextSchema(300),
  durationMin: z.coerce
    .number()
    .int()
    .refine((v) => (DURATIONS as readonly number[]).includes(v), 'Choose a duration'),
  price: moneyInputSchema,
  bufferBeforeMin: z.coerce
    .number()
    .int()
    .refine((v) => [0, 5, 10, 15].includes(v)),
  bufferAfterMin: z.coerce
    .number()
    .int()
    .refine((v) => [0, 5, 10, 15].includes(v)),
  staffIds: z
    .array(uuidSchema)
    .min(1, "Pick at least one person, or customers can't book it.")
    .max(100),
  availableOn: z.enum(['ALL', 'WEEKDAYS', 'SATURDAYS']),
  maxAdvanceDays: z
    .union([
      z.literal(''),
      z.literal(null),
      z.coerce
        .number()
        .int()
        .refine((v) => [7, 14, 30].includes(v)),
    ])
    .transform((v) => (v === '' || v === null ? null : v)),
  isOnline: z.boolean(),
});

export async function saveServiceAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; name: string; created: boolean }>> {
  return runAction('saveService', async () => {
    const ctx = await requireTenant(tenantSlug, 'services.manage');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const input = parseInput(serviceSchema, raw);
    const res = await withTransaction(async (tx) => {
      // Staff must belong to this tenant (composite FKs would reject it too).
      const staff = await tx.staff.findMany({
        where: { tenantId: ctx.tenantId, id: { in: input.staffIds } },
        select: { id: true },
      });
      if (staff.length !== new Set(input.staffIds).size) {
        throw new AppError('VALIDATION', 'Choose staff from your team.', {
          fieldErrors: { staffIds: 'invalid' },
        });
      }
      const data = {
        name: input.name,
        description: input.description ?? null,
        durationMin: input.durationMin,
        priceMinor: input.price,
        bufferBeforeMin: input.bufferBeforeMin,
        bufferAfterMin: input.bufferAfterMin,
        availableOn: input.availableOn,
        maxAdvanceDays: input.maxAdvanceDays,
        isOnline: input.isOnline,
      };
      let id: string;
      let created = false;
      if (input.id) {
        const existing = await tx.service.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          select: { id: true },
        });
        if (!existing) throw new AppError('NOT_FOUND', 'Service not found.');
        await tx.service.update({ where: { id: existing.id }, data });
        id = existing.id;
      } else {
        const svc = await tx.service.create({
          data: { ...data, tenantId: ctx.tenantId, currency: ctx.currency },
        });
        id = svc.id;
        created = true;
      }
      await tx.staffService.deleteMany({ where: { tenantId: ctx.tenantId, serviceId: id } });
      await tx.staffService.createMany({
        data: input.staffIds.map((staffId) => ({ tenantId: ctx.tenantId, staffId, serviceId: id })),
      });
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: created ? 'service.created' : 'service.updated',
          targetType: 'service',
          targetId: id,
          metadata: { name: input.name, durationMin: input.durationMin, priceMinor: input.price },
        },
        tx,
      );
      return { id, name: input.name, created };
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return res;
  });
}

export async function setServiceActiveAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ name: string }>> {
  return runAction('setServiceActive', async () => {
    const ctx = await requireTenant(tenantSlug, 'services.manage');
    const input = parseInput(z.object({ id: uuidSchema, active: z.boolean() }), raw);
    const res = await withTransaction(async (tx) => {
      const svc = await tx.service.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
      if (!svc) throw new AppError('NOT_FOUND', 'Service not found.');
      await tx.service.update({
        where: { id: svc.id },
        data: { isActive: input.active, isOnline: input.active },
      });
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: input.active ? 'service.reactivated' : 'service.deactivated',
          targetType: 'service',
          targetId: svc.id,
        },
        tx,
      );
      return { name: svc.name };
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return res;
  });
}
