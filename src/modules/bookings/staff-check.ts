import 'server-only';
import { DateTime } from 'luxon';
import { getDb } from '@/lib/db/client';
import { evaluateSlot, staffDay, type SlotReason } from '@/modules/scheduling/availability';
import { loadScheduleData } from '@/modules/scheduling/load';
import { formatMinutes, localMinutesToInstant } from '@/modules/scheduling/time';

export interface SlotCheck {
  ok: boolean;
  reason?: SlotReason;
  message: string;
}

function firstName(name: string) {
  return name.replace(/^Dr\.\s+/, '').split(/\s+/)[0] ?? name;
}

function timeRange(startMs: number, endMs: number, tz: string): string {
  const a = DateTime.fromMillis(startMs, { zone: tz });
  const b = DateTime.fromMillis(endMs, { zone: tz });
  const fmt = (d: DateTime) => formatMinutes(d.hour * 60 + d.minute);
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
}): Promise<SlotCheck> {
  const db = getDb();
  const [service, staff, policy] = await Promise.all([
    db.service.findFirst({ where: { id: params.serviceId, tenantId: params.tenantId } }),
    db.staff.findFirst({
      where: { id: params.staffId, tenantId: params.tenantId },
      include: { services: true },
    }),
    db.bookingPolicy.findUnique({ where: { tenantId: params.tenantId } }),
  ]);
  if (!service || !staff || !policy)
    return { ok: false, message: 'Choose a service and a staff member.' };
  const fn = firstName(staff.displayName);
  if (!staff.services.some((s) => s.serviceId === service.id)) {
    return { ok: false, message: `${staff.displayName} doesn't offer ${service.name}.` };
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
  const dayLabel = DateTime.fromISO(params.date, { zone: params.tz }).toFormat('cccc, LLL d');
  if (r.ok)
    return {
      ok: true,
      message: `${dayLabel}, ${timeRange(r.startMs, r.endMs, params.tz)} is free for ${fn}.`,
    };

  const weekday = DateTime.fromISO(params.date, { zone: params.tz }).toFormat('cccc');
  switch (r.reason) {
    case 'past':
      return { ok: false, reason: r.reason, message: 'That time has already passed.' };
    case 'business_closed':
      return {
        ok: false,
        reason: r.reason,
        message: `${params.businessName} is closed on ${dayLabel}.`,
      };
    case 'not_working_day':
      return { ok: false, reason: r.reason, message: `${fn} doesn't work on ${weekday}s.` };
    case 'break':
      return { ok: false, reason: r.reason, message: `That runs into ${fn}'s break.` };
    case 'blocked': {
      const day = staffDay(data, staff.id, params.date);
      const startMs = localMinutesToInstant(params.date, params.startMin, params.tz);
      const block = day.blocksMinutes.find(
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
          ? `${fn} has blocked ${formatMinutes(block.start)}–${formatMinutes(block.end)}${ex?.reason ? `: ${ex.reason}` : ''}.`
          : `${fn} isn't available then.`,
      };
    }
    case 'outside_hours': {
      const day = staffDay(data, staff.id, params.date);
      const periods = day.shiftMinutes
        .map((p) => `${formatMinutes(p.start)}–${formatMinutes(p.end)}`)
        .join(', ');
      return {
        ok: false,
        reason: r.reason,
        message: `Outside ${fn}'s working hours (${periods}).`,
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
          ? `Overlaps ${other.contactName}, ${timeRange(other.startAt.getTime(), other.endAt.getTime(), params.tz)} (${other.serviceNameSnapshot}) with ${fn}.`
          : `${fn} is already booked then.`,
      };
    }
    default:
      return { ok: false, reason: r.reason, message: "That time isn't available." };
  }
}
