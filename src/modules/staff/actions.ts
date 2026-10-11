'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withTransaction } from '@/lib/db/tx';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { requireTenant } from '@/lib/auth/authorize';
import { enforceRateLimit } from '@/lib/rate-limit';
import { nameSchema, optionalTextSchema, parseInput, uuidSchema } from '@/lib/validation';
import { audit } from '@/modules/audit/audit';
import { msg } from '@/i18n/message-ref';

const staffSchema = z.object({
  id: uuidSchema.optional(),
  displayName: nameSchema('name', 80),
  title: optionalTextSchema(80),
  bio: optionalTextSchema(300),
  serviceIds: z.array(uuidSchema).max(200),
  isActive: z.boolean(),
});

export async function saveStaffAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; name: string; created: boolean }>> {
  return runAction('saveStaff', async () => {
    const ctx = await requireTenant(tenantSlug, 'staff.manage');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const input = parseInput(staffSchema, raw);
    const result = await withTransaction(async (tx) => {
      const svcCount = await tx.service.count({
        where: { tenantId: ctx.tenantId, id: { in: input.serviceIds } },
      });
      if (svcCount !== new Set(input.serviceIds).size)
        throw new AppError('VALIDATION', msg('chooseServicesFromList'));
      const data = {
        displayName: input.displayName,
        title: input.title ?? null,
        bio: input.bio ?? null,
        isActive: input.isActive,
      };
      let id: string;
      let created = false;
      if (input.id) {
        const existing = await tx.staff.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          select: { id: true },
        });
        if (!existing) throw new AppError('NOT_FOUND', msg('staffNotFound'));
        await tx.staff.update({ where: { id: existing.id }, data });
        id = existing.id;
      } else {
        id = (await tx.staff.create({ data: { ...data, tenantId: ctx.tenantId } })).id;
        created = true;
      }
      await tx.staffService.deleteMany({ where: { tenantId: ctx.tenantId, staffId: id } });
      if (input.serviceIds.length) {
        await tx.staffService.createMany({
          data: input.serviceIds.map((serviceId) => ({
            tenantId: ctx.tenantId,
            staffId: id,
            serviceId,
          })),
        });
      }
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: created ? 'staff.created' : 'staff.updated',
          targetType: 'staff',
          targetId: id,
          metadata: {
            name: input.displayName,
            active: input.isActive,
            services: input.serviceIds.length,
          },
        },
        tx,
      );
      return { id, name: input.displayName, created };
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return result;
  });
}
