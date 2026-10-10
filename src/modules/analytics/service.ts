import 'server-only';
import { getDb } from '@/lib/db/client';
import type { TenantContext } from '@/lib/auth/authorize';
import {
  addDays,
  daysBetween,
  isValidLocalDate,
  localMinutesToInstant,
  todayIn,
} from '@/modules/scheduling/time';
import {
  type ApptRow,
  type PaymentRow,
  buckets,
  busiestDays,
  chooseGranularity,
  collectedMinor,
  peakHours,
  popularServices,
  totals,
} from './aggregate';

export type RangeKey = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface ResolvedRange {
  key: RangeKey;
  from: string;
  to: string;
  days: number;
  prevFrom: string;
  prevTo: string;
}

const MAX_CUSTOM_DAYS = 366;

export function resolveRange(
  key: string | undefined,
  tz: string,
  now: Date,
  customFrom?: string,
  customTo?: string,
): ResolvedRange {
  const today = todayIn(tz, now.getTime());
  let from = today;
  let to = today;
  let k: RangeKey = '30d';
  switch (key) {
    case 'today':
      k = 'today';
      break;
    case '7d':
      k = '7d';
      from = addDays(today, -6);
      break;
    case '90d':
      k = '90d';
      from = addDays(today, -89);
      break;
    case 'custom':
      if (
        customFrom &&
        customTo &&
        isValidLocalDate(customFrom) &&
        isValidLocalDate(customTo) &&
        customFrom <= customTo
      ) {
        k = 'custom';
        from = customFrom;
        to = customTo;
        if (daysBetween(from, to) > MAX_CUSTOM_DAYS) from = addDays(to, -MAX_CUSTOM_DAYS);
        break;
      }
      from = addDays(today, -29);
      break;
    default:
      from = addDays(today, -29);
  }
  const days = daysBetween(from, to) + 1;
  return { key: k, from, to, days, prevFrom: addDays(from, -days), prevTo: addDays(from, -1) };
}

function instantRange(tz: string, from: string, to: string) {
  return {
    gte: new Date(localMinutesToInstant(from, 0, tz)),
    lt: new Date(localMinutesToInstant(addDays(to, 1), 0, tz)),
  };
}

const APPT_SELECT = {
  startAt: true,
  endAt: true,
  status: true,
  quotedPriceMinor: true,
  serviceNameSnapshot: true,
  staffId: true,
  durationMin: true,
} as const;

export interface AnalyticsFilters {
  staffId?: string;
  serviceId?: string;
}

/** Load period + previous-period rows for ONE tenant. */
export async function loadPeriod(
  ctx: Pick<TenantContext, 'tenantId' | 'timezone'>,
  range: ResolvedRange,
  filters: AnalyticsFilters = {},
) {
  const db = getDb();
  const where = {
    tenantId: ctx.tenantId,
    ...(filters.staffId ? { staffId: filters.staffId } : {}),
    ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
  };
  const [rows, prevRows, payments] = await Promise.all([
    db.appointment.findMany({
      where: { ...where, startAt: instantRange(ctx.timezone, range.from, range.to) },
      select: APPT_SELECT,
    }),
    db.appointment.findMany({
      where: { ...where, startAt: instantRange(ctx.timezone, range.prevFrom, range.prevTo) },
      select: APPT_SELECT,
    }),
    db.paymentRecord.findMany({
      where: {
        tenantId: ctx.tenantId,
        recordedAt: instantRange(ctx.timezone, range.from, range.to),
        ...(filters.staffId || filters.serviceId
          ? {
              appointment: {
                ...(filters.staffId ? { staffId: filters.staffId } : {}),
                ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
              },
            }
          : {}),
      },
      select: { kind: true, amountMinor: true, recordedAt: true, voidedAt: true },
    }),
  ]);
  return {
    rows: rows as ApptRow[],
    prevRows: prevRows as ApptRow[],
    payments: payments as PaymentRow[],
  };
}

export async function loadOverview(ctx: TenantContext, range: ResolvedRange, now = new Date()) {
  const db = getDb();
  const today = todayIn(ctx.timezone, now.getTime());
  const [{ rows, prevRows, payments }, todayAppts, upcomingList, upcomingCounts] =
    await Promise.all([
      loadPeriod(ctx, range),
      db.appointment.findMany({
        where: { tenantId: ctx.tenantId, startAt: instantRange(ctx.timezone, today, today) },
        orderBy: { startAt: 'asc' },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          status: true,
          contactName: true,
          serviceNameSnapshot: true,
          staff: { select: { displayName: true } },
        },
      }),
      db.appointment.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startAt: { gt: now },
        },
        orderBy: { startAt: 'asc' },
        take: 7,
        select: {
          id: true,
          startAt: true,
          status: true,
          contactName: true,
          serviceNameSnapshot: true,
          staff: { select: { displayName: true } },
        },
      }),
      db.appointment.groupBy({
        by: ['status'],
        where: {
          tenantId: ctx.tenantId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startAt: { gt: now },
        },
        _count: { _all: true },
      }),
    ]);

  const cur = totals(rows, now);
  const prev = totals(prevRows, now);
  const g = chooseGranularity(range.days);
  const upcomingTotal = upcomingCounts.reduce((s, r) => s + r._count._all, 0);
  const pendingTotal = upcomingCounts.find((r) => r.status === 'PENDING')?._count._all ?? 0;

  return {
    range,
    hasAnyData:
      rows.length > 0 || todayAppts.length > 0 || upcomingTotal > 0 || prevRows.length > 0,
    kpi: {
      todayCount: todayAppts.filter((a) => a.status !== 'CANCELLED').length,
      todayDone: todayAppts.filter((a) => a.status === 'COMPLETED').length,
      todayToCome: todayAppts.filter(
        (a) => (a.status === 'PENDING' || a.status === 'CONFIRMED') && a.startAt > now,
      ).length,
      todayCancelled: todayAppts.filter((a) => a.status === 'CANCELLED').length,
      upcoming: upcomingTotal,
      pending: pendingTotal,
      completed: cur.completed,
      completedPrev: prev.completed,
      estimatedMinor: cur.estimatedMinor,
      collectedMinor: collectedMinor(payments),
      cancellationRate: cur.cancellationRate,
      cancellationRatePrev: prev.total ? prev.cancellationRate : null,
    },
    today: todayAppts,
    upcoming: upcomingList,
    chart: buckets(rows, ctx.timezone, range.from, range.to, g),
    granularity: g,
    popular: popularServices(rows),
    peak: peakHours(rows, ctx.timezone),
    days: busiestDays(rows, ctx.timezone, range.from, range.to),
  };
}

export type OverviewData = Awaited<ReturnType<typeof loadOverview>>;
