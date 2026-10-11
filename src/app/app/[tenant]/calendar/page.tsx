import type { Metadata } from 'next';
import { DateTime } from 'luxon';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { staffDay } from '@/modules/scheduling/availability';
import { loadScheduleData } from '@/modules/scheduling/load';
import {
  addDays,
  isValidLocalDate,
  localMinutesOf,
  localDateOf,
  localMinutesToInstant,
  todayIn,
} from '@/modules/scheduling/time';
import { CalendarView, type CalDay } from '@/components/features/calendar/CalendarView';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.nav.calendar };
}

const STATUS_FILTERS: Record<string, string[]> = {
  active: ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'],
  all: ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  pending: ['PENDING'],
  confirmed: ['CONFIRMED'],
  completed: ['COMPLETED'],
  noshow: ['NO_SHOW'],
};

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await params;
  const sp = await searchParams;
  const ctx = await requireTenantPage(tenant, 'appointments.read');
  const db = getDb();
  const tz = ctx.timezone;
  const today = todayIn(tz);
  const view = sp.view === 'day' || sp.view === 'month' ? sp.view : 'week';
  const anchor = sp.date && isValidLocalDate(sp.date) ? sp.date : today;
  const statusKey = sp.status && STATUS_FILTERS[sp.status] ? sp.status : 'active';

  const anchorDt = DateTime.fromISO(anchor, { zone: 'UTC' });
  let from: string;
  let to: string;
  if (view === 'day') {
    from = to = anchor;
  } else if (view === 'week') {
    from = anchorDt.startOf('week').toISODate()!;
    to = addDays(from, 6);
  } else {
    from = anchorDt.startOf('month').startOf('week').toISODate()!;
    to = addDays(from, 41);
  }

  const [allStaff, services] = await Promise.all([
    db.staff.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      select: { id: true, displayName: true },
    }),
    db.service.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);
  const selectedStaff = (sp.staff ?? '')
    .split(',')
    .filter((id) => allStaff.some((s) => s.id === id));
  const staff = selectedStaff.length
    ? allStaff.filter((s) => selectedStaff.includes(s.id))
    : allStaff;
  const serviceId = services.some((s) => s.id === sp.svc) ? sp.svc! : null;

  const [schedule, appts] = await Promise.all([
    loadScheduleData(db, {
      tenantId: ctx.tenantId,
      tz,
      fromDate: from,
      toDate: to,
      staffIds: staff.map((s) => s.id),
    }),
    db.appointment.findMany({
      where: {
        tenantId: ctx.tenantId,
        staffId: { in: staff.map((s) => s.id) },
        status: { in: STATUS_FILTERS[statusKey] as never },
        ...(serviceId ? { serviceId } : {}),
        startAt: {
          gte: new Date(localMinutesToInstant(from, 0, tz)),
          lt: new Date(localMinutesToInstant(addDays(to, 1), 0, tz)),
        },
      },
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        staffId: true,
        startAt: true,
        endAt: true,
        status: true,
        contactName: true,
        serviceNameSnapshot: true,
      },
    }),
  ]);

  // Visible hours: business hours envelope, default 9:00–19:00.
  const bizRules = schedule.rules.filter((r) => r.staffId === null);
  const minStart = bizRules.length ? Math.min(...bizRules.map((r) => r.startMin)) : 540;
  const maxEnd = bizRules.length ? Math.max(...bizRules.map((r) => r.endMin)) : 1140;
  const h0 = Math.max(0, Math.floor(Math.min(minStart, 540) / 60) * 60);
  const h1 = Math.min(1440, Math.ceil(Math.max(maxEnd, 1140) / 60) * 60);

  const dayCount = view === 'day' ? 1 : view === 'week' ? 7 : 42;
  const days: CalDay[] = Array.from({ length: dayCount }, (_, i) => {
    const date = addDays(from, i);
    return {
      date,
      isToday: date === today,
      inMonth: view !== 'month' || date.slice(0, 7) === anchor.slice(0, 7),
      lanes: staff.map((s) => {
        const d = staffDay(schedule, s.id, date);
        const blocks = schedule.exceptions
          .filter(
            (e) =>
              e.type === 'BLOCK' && (e.staffId === null || e.staffId === s.id) && e.date === date,
          )
          .map((e) => ({ start: e.startMin!, end: e.endMin!, label: e.reason ?? null }));
        return {
          staffId: s.id,
          shifts: d.shiftMinutes,
          blocks,
          items: appts
            .filter((a) => a.staffId === s.id && localDateOf(a.startAt.getTime(), tz) === date)
            .map((a) => ({
              id: a.id,
              startMin: localMinutesOf(a.startAt.getTime(), tz),
              endMin:
                localDateOf(a.endAt.getTime(), tz) === date
                  ? localMinutesOf(a.endAt.getTime(), tz)
                  : 1440,
              status: a.status,
              customer: a.contactName,
              service: a.serviceNameSnapshot,
            })),
        };
      }),
    };
  });

  return (
    <CalendarView
      view={view}
      anchor={anchor}
      days={days}
      staff={staff.map((s) => ({ id: s.id, name: s.displayName }))}
      allStaff={allStaff.map((s) => ({ id: s.id, name: s.displayName }))}
      selectedStaff={selectedStaff}
      services={services}
      serviceId={serviceId}
      statusKey={statusKey}
      hours={[h0, h1]}
    />
  );
}
