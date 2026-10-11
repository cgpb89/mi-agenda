import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { AppError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { clientIpFrom } from '@/lib/security/request';
import { parseInput, uuidSchema } from '@/lib/validation';
import { daySlots } from '@/modules/scheduling/availability';
import { loadScheduleData } from '@/modules/scheduling/load';
import { LOCAL_DATE_RE, addDays, daysBetween, todayIn } from '@/modules/scheduling/time';
import { errorResponse, ok } from '@/modules/public/http';
import { isClosed } from '@/modules/billing/access';
import { msg } from '@/i18n/message-ref';

const DAYS = 14;

const query = z.object({
  serviceId: uuidSchema,
  staff: z.union([z.literal('any'), uuidSchema]),
  date: z.string().regex(LOCAL_DATE_RE).optional(),
});

/**
 * Public slot lookup. Returns only whether each start time is bookable — no
 * appointment, customer or staff-schedule details (prevents enumeration).
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    await enforceRateLimit('slotsByIp', clientIpFrom(request.headers));
    const url = new URL(request.url);
    const q = parseInput(query, Object.fromEntries(url.searchParams));
    const db = getDb();
    const tenant = await db.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        timezone: true,
        status: true,
        accessUntil: true,
        profile: { select: { pageStatus: true } },
        policy: true,
      },
    });
    if (
      !tenant ||
      !tenant.policy ||
      tenant.profile?.pageStatus !== 'PUBLISHED' ||
      (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') ||
      isClosed(tenant.accessUntil)
    ) {
      throw new AppError('NOT_FOUND', msg('notFound'));
    }
    const service = await db.service.findFirst({
      where: { id: q.serviceId, tenantId: tenant.id, isActive: true, isOnline: true },
    });
    if (!service) throw new AppError('NOT_FOUND', msg('notFound'));
    const staff = await db.staff.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        services: { some: { serviceId: service.id } },
        ...(q.staff !== 'any' ? { id: q.staff } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      select: { id: true },
    });
    if (!staff.length) throw new AppError('NOT_FOUND', msg('notFound'));

    const now = Date.now();
    const today = todayIn(tenant.timezone, now);
    const last = addDays(today, DAYS - 1);
    const date = q.date && q.date >= today && q.date <= last ? q.date : today;
    const schedule = await loadScheduleData(db, {
      tenantId: tenant.id,
      tz: tenant.timezone,
      fromDate: today,
      toDate: last,
      staffIds: staff.map((s) => s.id),
    });
    const input = {
      staffIds: staff.map((s) => s.id),
      service,
      policy: tenant.policy,
      nowMs: now,
      mode: 'public' as const,
    };

    const days = Array.from({ length: DAYS }, (_, i) => {
      const d = addDays(today, i);
      const r = daySlots(schedule, { ...input, date: d });
      return {
        date: d,
        status: r.closed ? 'closed' : r.slots.some((s) => s.available) ? 'open' : 'full',
      };
    });
    const selected = daySlots(schedule, { ...input, date });
    return ok({
      today,
      date,
      timezone: tenant.timezone,
      days,
      beyondWindow:
        daysBetween(today, last) > (service.maxAdvanceDays ?? tenant.policy.maxAdvanceDays),
      slots: selected.closed
        ? null
        : selected.slots.map((s) => ({ startMin: s.startMin, available: s.available })),
    });
  } catch (err) {
    return errorResponse(err, 'public.availability');
  }
}
