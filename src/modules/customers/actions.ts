'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withTransaction } from '@/lib/db/tx';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { requireTenant } from '@/lib/auth/authorize';
import { normalizePhone } from '@/lib/phone';
import { isUniqueViolation } from '@/lib/db/errors';
import {
  nameSchema,
  optionalEmailSchema,
  optionalTextSchema,
  parseInput,
  uuidSchema,
} from '@/lib/validation';
import { audit } from '@/modules/audit/audit';
import { msg } from '@/i18n/message-ref';

const schema = z.object({
  id: uuidSchema,
  name: nameSchema('name'),
  email: optionalEmailSchema,
  phone: z.string().max(32).optional(),
  phoneCountry: z.string().length(2).optional(),
  notes: optionalTextSchema(1000, true),
});

/** Staff-confirmed edits to a customer record (the source of truth after verification in person). */
export async function updateCustomerAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('updateCustomer', async () => {
    const ctx = await requireTenant(tenantSlug, 'customers.write');
    const input = parseInput(schema, raw);
    let phoneE164: string | null = null;
    if (input.phone && input.phone.trim()) {
      const p = normalizePhone(input.phone, input.phoneCountry ?? ctx.country);
      if (!p.ok)
        throw new AppError('VALIDATION', msg('phoneLooksWrong'), {
          fieldErrors: { phone: msg('checkNumberAndCountry') },
        });
      phoneE164 = p.e164;
    }
    try {
      await withTransaction(async (tx) => {
        const res = await tx.customer.updateMany({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: {
            name: input.name,
            email: input.email ?? null,
            phoneE164,
            notes: input.notes ?? null,
          },
        });
        if (res.count !== 1) throw new AppError('NOT_FOUND', msg('customerNotFound'));
        await audit(
          {
            tenantId: ctx.tenantId,
            actorUserId: ctx.userId,
            actorType: 'user',
            action: 'customer.updated',
            targetType: 'customer',
            targetId: input.id,
          },
          tx,
        );
      });
    } catch (err) {
      if (isUniqueViolation(err))
        throw new AppError('CONFLICT', msg('phoneUsedByOther'), {
          fieldErrors: { phone: msg('phoneUsedByOtherField') },
        });
      throw err;
    }
    revalidatePath(`/app/${tenantSlug}/customers`, 'layout');
    return undefined;
  });
}
