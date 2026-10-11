'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withTransaction } from '@/lib/db/tx';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { requireTenant } from '@/lib/auth/authorize';
import { enforceRateLimit } from '@/lib/rate-limit';
import { nameSchema, optionalTextSchema, parseInput, uuidSchema } from '@/lib/validation';
import { now } from '@/lib/time';
import { audit } from '@/modules/audit/audit';
import { canAddStaff } from '@/modules/plans/features';
import { entitlementsFor } from '@/modules/plans/service';
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
    const plan = await entitlementsFor(ctx.plan);
    const result = await withTransaction(async (tx) => {
      // Plan staff limit, checked when this save would add an active member.
      if (input.isActive && plan.staffLimit !== null) {
        // Serialize concurrent saves for this business so the count can't race.
        await tx.$queryRaw`SELECT 1 FROM "app"."tenants" WHERE "id" = ${ctx.tenantId}::uuid FOR UPDATE`;
        const othersActive = await tx.staff.count({
          where: {
            tenantId: ctx.tenantId,
            isActive: true,
            deletedAt: null,
            ...(input.id ? { id: { not: input.id } } : {}),
          },
        });
        if (!canAddStaff(plan, othersActive)) {
          throw new AppError('POLICY', msg('staffLimit', { n: plan.staffLimit }));
        }
      }
      const svcCount = await tx.service.count({
        where: { tenantId: ctx.tenantId, id: { in: input.serviceIds }, deletedAt: null },
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
          where: { id: input.id, tenantId: ctx.tenantId, deletedAt: null },
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

/**
 * Remove a staff member from the business. Refused while they still have
 * upcoming appointments. With no appointment history the row is deleted;
 * otherwise it is kept (past appointments reference it) but marked deleted,
 * unlinked from its login and stripped of services and shifts.
 */
export async function deleteStaffAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ name: string }>> {
  return runAction('deleteStaff', async () => {
    const ctx = await requireTenant(tenantSlug, 'staff.manage');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const { id } = parseInput(z.object({ id: uuidSchema }), raw);
    const res = await withTransaction(async (tx) => {
      const staff = await tx.staff.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true, displayName: true },
      });
      if (!staff) throw new AppError('NOT_FOUND', msg('staffNotFound'));
      const [upcoming, history] = await Promise.all([
        tx.appointment.count({
          where: {
            tenantId: ctx.tenantId,
            staffId: id,
            status: { in: ['PENDING', 'CONFIRMED'] },
            startAt: { gt: now() },
          },
        }),
        tx.appointment.count({ where: { tenantId: ctx.tenantId, staffId: id } }),
      ]);
      if (upcoming) throw new AppError('POLICY', msg('staffHasUpcoming', { n: upcoming }));
      if (history === 0) {
        // Cascades to their service links, shifts and time off.
        await tx.staff.delete({ where: { id } });
      } else {
        await tx.staffService.deleteMany({ where: { tenantId: ctx.tenantId, staffId: id } });
        await tx.availabilityRule.deleteMany({ where: { tenantId: ctx.tenantId, staffId: id } });
        await tx.availabilityException.deleteMany({
          where: { tenantId: ctx.tenantId, staffId: id },
        });
        await tx.staff.update({
          where: { id },
          data: { deletedAt: now(), isActive: false, userId: null },
        });
      }
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'staff.deleted',
          targetType: 'staff',
          targetId: id,
          metadata: { name: staff.displayName, keptForHistory: history > 0 },
        },
        tx,
      );
      return { name: staff.displayName };
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    revalidatePath(`/book/${tenantSlug}`);
    return res;
  });
}
