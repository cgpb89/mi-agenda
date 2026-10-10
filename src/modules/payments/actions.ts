'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { runAction, type ActionResult } from '@/lib/errors';
import { assertCan, assertCanManageAssigned, requireTenant } from '@/lib/auth/authorize';
import { enforceRateLimit } from '@/lib/rate-limit';
import { moneyInputSchema, optionalTextSchema, parseInput, uuidSchema } from '@/lib/validation';
import { recordPayment, voidPayment } from './service';

const recordSchema = z.object({
  appointmentId: uuidSchema,
  kind: z.enum(['PAYMENT', 'REFUND']),
  amount: moneyInputSchema,
  method: z.enum(['CASH', 'CARD', 'OTHER']),
  note: optionalTextSchema(200),
});

/** Record money explicitly collected in person (no online payment processing). */
export async function recordPaymentAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction('recordPayment', async () => {
    const ctx = await requireTenant(tenantSlug, 'appointments.read');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const input = parseInput(recordSchema, raw);
    const rec = await recordPayment({
      tenantId: ctx.tenantId,
      appointmentId: input.appointmentId,
      kind: input.kind,
      amountMinor: input.amount,
      method: input.method,
      note: input.note,
      actorUserId: ctx.userId,
      guard: (appt) => {
        assertCanManageAssigned(ctx, 'payments.record.any', 'payments.record.own', appt.staffId);
        // Refunds are a manager-level correction.
        if (input.kind === 'REFUND') assertCan(ctx, 'payments.void');
      },
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return { id: rec.id };
  });
}

const voidSchema = z.object({
  paymentId: uuidSchema,
  reason: z.string().trim().min(1, 'Add a reason').max(200),
});

export async function voidPaymentAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('voidPayment', async () => {
    const ctx = await requireTenant(tenantSlug, 'payments.void');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const input = parseInput(voidSchema, raw);
    await voidPayment({
      tenantId: ctx.tenantId,
      paymentId: input.paymentId,
      reason: input.reason,
      actorUserId: ctx.userId,
    });
    revalidatePath(`/app/${tenantSlug}`, 'layout');
    return undefined;
  });
}
