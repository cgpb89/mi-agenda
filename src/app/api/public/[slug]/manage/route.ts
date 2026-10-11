import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertSameOrigin, clientIpFrom } from '@/lib/security/request';
import { hmacHex } from '@/lib/security/tokens';
import { getEnv } from '@/lib/env';
import { parseInput } from '@/lib/validation';
import { rescheduleAppointment } from '@/modules/bookings/engine';
import { transitionAppointment } from '@/modules/bookings/lifecycle';
import { LOCAL_DATE_RE } from '@/modules/scheduling/time';
import { findByManageToken } from '@/modules/public/manage';
import { errorResponse, ok, readJson } from '@/modules/public/http';
import { msg } from '@/i18n/message-ref';
import { CUSTOMER_CANCEL_REASON } from '@/modules/bookings/rules';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel'), token: z.string().min(40).max(64) }),
  z.object({
    action: z.literal('reschedule'),
    token: z.string().min(40).max(64),
    date: z.string().regex(LOCAL_DATE_RE),
    startMin: z.number().int().min(0).max(1439),
  }),
]);

/** Customer self-service via the secret manage link (token in body, not URL query). */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    await enforceRateLimit('manageByIp', clientIpFrom(request.headers));
    const body = parseInput(bodySchema, await readJson(request));
    await enforceRateLimit('manageByToken', hmacHex(getEnv().RATE_LIMIT_SECRET, body.token));
    const appt = await findByManageToken(slug, body.token);
    // Same response for unknown and foreign tokens.
    if (!appt) throw new AppError('NOT_FOUND', msg('manageLinkInvalid'));
    if (!appt.canModify) {
      throw new AppError(
        'POLICY',
        appt.status === 'CANCELLED' || appt.status === 'COMPLETED' || appt.status === 'NO_SHOW'
          ? msg('cantChangeOnline')
          : msg('tooCloseToChange'),
      );
    }
    if (body.action === 'cancel') {
      await transitionAppointment({
        tenantId: appt.tenantId,
        appointmentId: appt.id,
        action: 'cancel',
        actorType: 'customer',
        reason: CUSTOMER_CANCEL_REASON,
      });
      return ok({ status: 'CANCELLED' });
    }
    const updated = await rescheduleAppointment({
      tenantId: appt.tenantId,
      appointmentId: appt.id,
      date: body.date,
      startMin: body.startMin,
      mode: 'public',
    });
    return ok({
      status: updated.status,
      startAt: updated.startAt.toISOString(),
      endAt: updated.endAt.toISOString(),
    });
  } catch (err) {
    return errorResponse(err, 'public.manage');
  }
}
