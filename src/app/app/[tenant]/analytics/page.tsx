import type { Metadata } from 'next';
import { DateTime } from 'luxon';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import {
  buckets,
  busiestDays,
  chooseGranularity,
  collectedMinor,
  peakHours,
  popularServices,
  totals,
  type Granularity,
} from '@/modules/analytics/aggregate';
import { loadPeriod, resolveRange } from '@/modules/analytics/service';
import { staffDay } from '@/modules/scheduling/availability';
import { loadScheduleData } from '@/modules/scheduling/load';
import { addDays } from '@/modules/scheduling/time';
import { AnalyticsView } from '@/components/features/analytics/AnalyticsView';
import { cheapestPlanWith, hasFeature } from '@/modules/plans/features';
import { entitlementsFor, getPlanCatalog } from '@/modules/plans/service';
import { getI18n, getLocale } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.nav.analytics };
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await params;
  const sp = await searchParams;
  const ctx = await requireTenantPage(tenant, 'analytics.read');
  const [plan, catalog] = await Promise.all([entitlementsFor(ctx.plan), getPlanCatalog()]);
  // Without full analytics: last 7 or 30 days only, no staff/service filters.
  const limited = !hasFeature(plan, 'fullAnalytics');
  if (limited) {
    if (sp.range !== '7d') sp.range = '30d';
    delete sp.from;
    delete sp.to;
    delete sp.staff;
    delete sp.svc;
  }
  const db = getDb();
  const now = new Date();
  const range =
    sp.range === '12m'
      ? resolveRange(
          'custom',
          ctx.timezone,
          now,
          addDays(DateTime.now().setZone(ctx.timezone).toISODate()!, -364),
          DateTime.now().setZone(ctx.timezone).toISODate()!,
        )
      : resolveRange(sp.range ?? '30d', ctx.timezone, now, sp.from, sp.to);
  const rangeKey = sp.range === '12m' ? '12m' : range.key;

  const [staff, services] = await Promise.all([
    db.staff.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true },
    }),
    db.service.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);
  const staffId = staff.some((s) => s.id === sp.staff) ? sp.staff : undefined;
  const serviceId = services.some((s) => s.id === sp.svc) ? sp.svc : undefined;

  const { rows, prevRows, payments } = await loadPeriod(ctx, range, { staffId, serviceId });
  const auto = chooseGranularity(range.days);
  const g: Granularity =
    sp.by === 'day' || sp.by === 'week' || sp.by === 'month'
      ? sp.by
      : auto === 'hour'
        ? 'day'
        : auto;
  const series = buckets(rows, ctx.timezone, range.from, range.to, g, undefined, await getLocale());

  // Collected by bucket (recorded date).
  const collectedSeries = series.map((b) => ({ key: b.key, minor: 0 }));
  for (const p of payments) {
    if (p.voidedAt) continue;
    const local = DateTime.fromJSDate(p.recordedAt, { zone: ctx.timezone });
    const key =
      g === 'day'
        ? local.toISODate()!
        : g === 'week'
          ? local.startOf('week').toISODate()!
          : local.toFormat('yyyy-LL');
    const b = collectedSeries.find((x) => x.key === key);
    if (b) b.minor += p.kind === 'PAYMENT' ? p.amountMinor : -p.amountMinor;
  }

  // Utilisation: booked minutes ÷ working minutes of the (filtered) staff.
  const staffIds = staffId
    ? [staffId]
    : (
        await db.staff.findMany({
          where: { tenantId: ctx.tenantId, isActive: true },
          select: { id: true },
        })
      ).map((s) => s.id);
  const schedule = await loadScheduleData(db, {
    tenantId: ctx.tenantId,
    tz: ctx.timezone,
    fromDate: range.from,
    toDate: range.to,
    staffIds,
  });
  let workMinutes = 0;
  for (let i = 0; i < range.days; i++) {
    const date = addDays(range.from, i);
    for (const id of staffIds)
      workMinutes += staffDay(schedule, id, date).workMinutes.reduce(
        (s, w) => s + (w.end - w.start),
        0,
      );
  }

  const cur = totals(rows, now);
  const prev = totals(prevRows, now);
  return (
    <AnalyticsView
      locked={limited ? { plan: cheapestPlanWith(catalog, 'fullAnalytics') } : null}
      rangeKey={rangeKey}
      range={range}
      granularity={g}
      filters={{ staffId: staffId ?? null, serviceId: serviceId ?? null }}
      staff={staff.map((s) => ({ id: s.id, name: s.displayName }))}
      services={services}
      cur={cur}
      prev={prev}
      collected={collectedMinor(payments)}
      utilisation={workMinutes ? cur.bookedMinutes / workMinutes : null}
      series={series.map((b, i) => ({ ...b, collectedMinor: collectedSeries[i]!.minor }))}
      popular={popularServices(rows, 8)}
      peak={peakHours(rows, ctx.timezone)}
      days={busiestDays(rows, ctx.timezone, range.from, range.to)}
    />
  );
}
