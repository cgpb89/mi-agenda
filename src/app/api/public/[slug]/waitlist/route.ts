import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { AppError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertSameOrigin, clientIpFrom } from '@/lib/security/request';
import { emailSchema, nameSchema, parseInput, uuidSchema } from '@/lib/validation';
import { LOCAL_DATE_RE } from '@/modules/scheduling/time';
import { errorResponse, ok, readJson } from '@/modules/public/http';
import { joinWaitlist } from '@/modules/waitlist/service';
import { msg } from '@/i18n/message-ref';
import { getI18n } from '@/i18n/server';

/** Join the waitlist for a full day (plan feature `waitlist`). */
const bodySchema = z.object({
  serviceId: uuidSchema,
  staffId: uuidSchema.nullable(),
  date: z.string().regex(LOCAL_DATE_RE),
  name: nameSchema('name'),
  email: emailSchema,
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(200).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    await enforceRateLimit('waitlistByIp', clientIpFrom(request.headers));
    const body = parseInput(bodySchema, await readJson(request));
    if (body.website) throw new AppError('VALIDATION', msg('bookingFailed'));
    const tenant = await getDb().tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!tenant) throw new AppError('NOT_FOUND', msg('notFound'));
    await enforceRateLimit('waitlistByTenant', tenant.id);
    await joinWaitlist({
      tenantId: tenant.id,
      serviceId: body.serviceId,
      staffId: body.staffId,
      date: body.date,
      name: body.name,
      email: body.email,
      locale: (await getI18n()).locale,
    });
    return ok({ joined: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'public.waitlist');
  }
}
