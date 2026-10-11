import 'server-only';
import { DateTime } from 'luxon';
import { getDb } from '@/lib/db/client';
import { evaluateSlot, staffDay, type SlotReason } from '@/modules/scheduling/availability';
import { loadScheduleData } from '@/modules/scheduling/load';
import { formatMinutes, localMinutesToInstant } from '@/modules/scheduling/time';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { messages } from '@/i18n/messages';

export interface SlotCheck {
  ok: boolean;
  reason?: SlotReason;
  message: string;
}

function firstName(name: string) {
  return name.replace(/^Dr\.\s+/, '').split(/\s+/)[0] ?? name;
}

function timeRange(startMs: number, endMs: number, tz: string, locale: Locale): string {
  const a = DateTime.fromMillis(startMs, { zone: tz });
  const b = DateTime.fromMillis(endMs, { zone: tz });
  const fmt = (d: DateTime) => formatMinutes(d.hour * 60 + d.minute, locale);
  return `${fmt(a)}–${fmt(b)}`;
}

/**
 * Human conflict check for the owner/staff "New appointment" and reschedule
 * UIs (messages follow the approved design). Advisory only — the booking
 * engine re-checks atomically on submit.
 */
export async function checkStaffSlot(params: {
  tenantId: string;
  tz: string;
  businessName: string;
  serviceId: string;
  staffId: string;
  date: string;
  startMin: number;
  excludeAppointmentId?: string;
  durationOverrideMin?: number;
  now?: Date;
  locale: Locale;
}): Promise<SlotCheck> {
  const db = getDb();
  const { locale } = params;
  const t = messages[locale].slotCheck;
  const minutes = (start: number, end: number) =>
    `${formatMinutes(start, locale)}–${formatMinutes(end, locale)}`;
  const [service, staff, policy] = await Promise.all([
    db.service.findFirst({ where: { id: params.serviceId, tenantId: params.tenantId } }),
    db.staff.findFirst({
      where: { id: params.staffId, tenantId: params.tenantId },
      include: { services: true },
    }),
    db.bookingPolicy.findUnique({ where: { tenantId: params.tenantId } }),
  ]);
  if (!service || !staff || !policy) return { ok: false, message: t.chooseServiceAndStaff };
  const fn = firstName(staff.displayName);
  if (!staff.services.some((s) => s.serviceId === service.id)) {
    return {
      ok: false,
      message: t.doesntOffer({ staff: staff.displayName, service: service.name }),
    };
  }
  const data = await loadScheduleData(db, {
    tenantId: params.tenantId,
    tz: params.tz,
    fromDate: params.date,
    toDate: params.date,
    staffIds: [staff.id],
  });
  const durationMin = params.durationOverrideMin ?? service.durationMin;
  const r = evaluateSlot(data, {
    staffId: staff.id,
    date: params.date,
    startMin: params.startMin,
    service: { ...service, durationMin },
    policy,
    nowMs: (params.now ?? new Date()).getTime(),
    mode: 'staff',
    excludeAppointmentId: params.excludeAppointmentId,
  });
  const day = DateTime.fromISO(params.date, { zone: params.tz }).setLocale(INTL_LOCALE[locale]);
  const dayLabel = day.toLocaleString({ weekday: 'long', month: 'short', day: 'numeric' });
  if (r.ok)
    return {
      ok: true,
      message: t.free({
        day: dayLabel,
        range: timeRange(r.startMs, r.endMs, params.tz, locale),
        staff: fn,
      }),
    };

  switch (r.reason) {
    case 'past':
      return { ok: false, reason: r.reason, message: t.past };
    case 'business_closed':
      return {
        ok: false,
        reason: r.reason,
        message: t.businessClosed({ business: params.businessName, day: dayLabel }),
      };
    case 'not_working_day':
      return {
        ok: false,
        reason: r.reason,
        message: t.notWorkingDay({ staff: fn, isoDay: day.weekday }),
      };
    case 'break':
      return { ok: false, reason: r.reason, message: t.onBreak({ staff: fn }) };
    case 'blocked': {
      const blocks = staffDay(data, staff.id, params.date);
      const startMs = localMinutesToInstant(params.date, params.startMin, params.tz);
      const block = blocks.blocksMinutes.find(
        (b) =>
          localMinutesToInstant(params.date, b.start, params.tz) < startMs + durationMin * 60_000 &&
          localMinutesToInstant(params.date, b.end, params.tz) > startMs,
      );
      const ex = data.exceptions.find(
        (e) => e.type === 'BLOCK' && block && e.startMin === block.start,
      );
      return {
        ok: false,
        reason: r.reason,
        message: block
          ? t.blocked({
              staff: fn,
              range: minutes(block.start, block.end),
              reason: ex?.reason ?? null,
            })
          : t.unavailableStaff({ staff: fn }),
      };
    }
    case 'outside_hours': {
      const shifts = staffDay(data, staff.id, params.date);
      const periods = shifts.shiftMinutes.map((p) => minutes(p.start, p.end)).join(', ');
      return {
        ok: false,
        reason: r.reason,
        message: t.outsideHours({ staff: fn, periods }),
      };
    }
    case 'booked': {
      const other = r.conflictId
        ? await db.appointment.findFirst({
            where: { id: r.conflictId, tenantId: params.tenantId },
            select: { contactName: true, startAt: true, endAt: true, serviceNameSnapshot: true },
          })
        : null;
      return {
        ok: false,
        reason: r.reason,
        message: other
          ? t.overlaps({
              customer: other.contactName,
              range: timeRange(other.startAt.getTime(), other.endAt.getTime(), params.tz, locale),
              service: other.serviceNameSnapshot,
              staff: fn,
            })
          : t.alreadyBooked({ staff: fn }),
      };
    }
    default:
      return { ok: false, reason: r.reason, message: t.unavailable };
  }
}
