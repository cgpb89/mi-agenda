import 'server-only';
import { getDb } from '@/lib/db/client';
import { manageTokenHash } from '@/modules/bookings/engine';
import { confirmationCode, customerCanModify } from '@/modules/bookings/rules';

const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;

/**
 * Resolve a customer self-service token to its appointment. The token is the
 * only credential: phone numbers are never used to look up bookings.
 */
export async function findByManageToken(slug: string, token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const a = await getDb().appointment.findFirst({
    where: { manageTokenHash: manageTokenHash(token), tenant: { slug } },
    select: {
      id: true,
      tenantId: true,
      refNumber: true,
      status: true,
      startAt: true,
      endAt: true,
      durationMin: true,
      serviceId: true,
      staffId: true,
      serviceNameSnapshot: true,
      quotedPriceMinor: true,
      currency: true,
      contactName: true,
      contactEmail: true,
      staff: { select: { displayName: true } },
      tenant: { select: { policy: { select: { cancellationWindowMin: true } } } },
    },
  });
  if (!a) return null;
  const windowMin = a.tenant.policy?.cancellationWindowMin ?? 0;
  const active = a.status === 'PENDING' || a.status === 'CONFIRMED';
  return {
    ...a,
    confirmationCode: confirmationCode(a.refNumber),
    canModify: active && customerCanModify(a.startAt, new Date(), windowMin),
    cancellationWindowMin: windowMin,
  };
}
