import type { Metadata } from 'next';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { AdminHeader } from '@/components/features/admin/AdminShell';
import { Segmented } from '@/components/ui/Segmented';
import { categoryLabel } from '@/components/features/shared/categories';
import s from '@/components/features/admin/Admin.module.scss';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { PLANS, type PlanKey } from '@/modules/platform/constants';
import { listTenants, platformAppointmentSeries } from '@/modules/platform/service';

export const metadata: Metadata = { title: 'Overview' };

const RANGES = { '30d': 30, '90d': 90, '12m': 365 } as const;
const PLAN_COLOR: Record<PlanKey, string> = {
  TRIAL: '#9fb8d9',
  STARTER: '#c9c2b6',
  GROWTH: '#2f6e5a',
  BUSINESS: '#1c1a17',
};

function money(minor: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export default async function PlatformOverview({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePlatformAdminPage();
  const { range: r } = await searchParams;
  const range = (r && r in RANGES ? r : '90d') as keyof typeof RANGES;
  const days = RANGES[range];
  const now = DateTime.utc();
  const from = now.minus({ days });
  const [tenants, series] = await Promise.all([
    listTenants(),
    platformAppointmentSeries(from.toJSDate()),
  ]);

  const total = tenants.length;
  const churned = tenants.filter((t) => t.status === 'CHURNED').length;
  const active = tenants.filter((t) => t.status === 'ACTIVE').length;
  const trial = tenants.filter((t) => t.status === 'TRIAL').length;
  const suspended = tenants.filter((t) => t.status === 'SUSPENDED').length;
  const newInRange = tenants.filter((t) => DateTime.fromISO(t.createdAt) >= from).length;
  const apptsInRange = series.reduce((sum, x) => sum + x.n, 0);
  const cohort = tenants.filter((t) => {
    const c = DateTime.fromISO(t.createdAt);
    return c >= from && c <= now.minus({ days: 21 });
  });
  const paid = cohort.filter((t) => t.status !== 'CHURNED' && t.plan !== 'TRIAL').length;
  const mrr = tenants
    .filter((t) => t.status === 'ACTIVE')
    .reduce((sum, t) => sum + PLANS[t.plan].priceMinor, 0);

  // Registration buckets
  const bucketCount = range === '12m' ? 12 : range === '90d' ? 13 : 10;
  const bucketDays = range === '12m' ? 0 : range === '90d' ? 7 : 3;
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const start =
      range === '12m'
        ? now.startOf('month').minus({ months: bucketCount - 1 - i })
        : now.startOf('day').minus({ days: bucketDays * (bucketCount - i) });
    const end = range === '12m' ? start.plus({ months: 1 }) : start.plus({ days: bucketDays });
    const v = tenants.filter((t) => {
      const c = DateTime.fromISO(t.createdAt);
      return c >= start && c < end;
    }).length;
    return { label: range === '12m' ? start.toFormat('LLL') : start.toFormat('L/d'), v };
  });
  const bMax = Math.max(1, ...buckets.map((b) => b.v));

  // Appointment area chart
  const dayKeys = Array.from({ length: days }, (_, i) => from.plus({ days: i + 1 }).toISODate()!);
  const counts = new Map(series.map((x) => [x.day, x.n]));
  const pts = dayKeys.map((d) => counts.get(d) ?? 0);
  const pMax = Math.max(1, ...pts);
  const line = pts
    .map(
      (v, i) =>
        `${((i / Math.max(1, pts.length - 1)) * 600).toFixed(1)},${(165 - (v / pMax) * 150).toFixed(1)}`,
    )
    .join(' ');

  const live = tenants.filter((t) => t.status !== 'CHURNED');
  const planDist = (Object.keys(PLANS) as PlanKey[]).map((p) => ({
    p,
    n: live.filter((t) => t.plan === p).length,
  }));
  const cats = ['BARBER', 'WELLNESS', 'CONSULT', 'FITNESS', 'SERVICES'].map((c) => ({
    c,
    n: tenants.filter((t) => t.category === c).length,
  }));
  const cMax = Math.max(1, ...cats.map((c) => c.n));
  const attention = tenants
    .flatMap((t) =>
      t.status === 'SUSPENDED'
        ? [{ t, why: 'Suspended account' }]
        : t.status === 'TRIAL' && t.pageStatus !== 'PUBLISHED'
          ? [{ t, why: 'Trial with an unpublished page' }]
          : t.status === 'ACTIVE' && t.pageStatus !== 'PUBLISHED'
            ? [{ t, why: 'Paying, booking page still in draft' }]
            : [],
    )
    .slice(0, 5);

  const kpis = [
    { label: 'Registered businesses', value: total, note: `${churned} churned all-time` },
    {
      label: 'Active businesses',
      value: active,
      note: `${trial} in trial · ${suspended} suspended`,
    },
    {
      label: 'New registrations',
      value: newInRange,
      note: `Last ${range === '12m' ? '12 months' : `${days} days`}`,
    },
    {
      label: 'Appointments, all tenants',
      value: apptsInRange.toLocaleString(),
      note: 'Created in range · count only',
    },
    {
      label: 'Trial → paid',
      value: cohort.length ? `${Math.round((paid / cohort.length) * 100)}%` : '—',
      note: `${cohort.length} trials ended in range`,
    },
    {
      label: 'Churn',
      value: total ? `${((churned / total) * 100).toFixed(1)}%` : '—',
      note: 'Share of all businesses ever registered',
    },
    {
      label: 'Platform MRR (placeholder)',
      value: money(mrr),
      note: 'Tempo subscriptions at placeholder prices',
    },
  ];

  return (
    <>
      <AdminHeader
        title="Platform overview"
        sub={`All tenants · as of ${now.toFormat('LLL d, yyyy')}`}
      >
        <Segmented
          platform
          label="Date range"
          items={[
            ['30d', '30 days'],
            ['90d', '90 days'],
            ['12m', '12 months'],
          ].map(([k, l]) => ({
            key: k!,
            label: l,
            selected: range === k,
            href: `/super-admin?range=${k}`,
          }))}
        />
      </AdminHeader>
      <div className={s.content}>
        <div className={s.kpis}>
          {kpis.map((k) => (
            <div key={k.label} className={s.kpi}>
              <span>{k.label}</span>
              <span>{k.value}</span>
              <span>{k.note}</span>
            </div>
          ))}
        </div>
        <div className={s.grid2}>
          <div className={s.card}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}
            >
              <span className={s.cardTitle}>New registrations</span>
              <span className={s.muted}>
                {range === '12m' ? 'Per month' : `Per ${bucketDays} days`}
              </span>
            </div>
            <div className={s.bars}>
              {buckets.map((b, i) => (
                <div key={i} title={`${b.v} new businesses`}>
                  <span>{b.v || ''}</span>
                  <span style={{ height: `${(b.v / bMax) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className={s.barLabels}>
              {buckets.map((b, i) => (
                <span key={i}>{b.label}</span>
              ))}
            </div>
          </div>
          <div className={s.card}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}
            >
              <span className={s.cardTitle}>Appointments booked across the platform</span>
              <span className={s.muted}>Count only · all tenants</span>
            </div>
            <svg
              viewBox="0 0 600 170"
              preserveAspectRatio="none"
              style={{
                width: '100%',
                height: 170,
                display: 'block',
                borderBottom: '1px solid #e2e2dc',
              }}
              role="img"
              aria-label="Appointments per day"
            >
              <polygon points={`0,170 ${line} 600,170`} fill="#e3efe9" />
              <polyline
                points={line}
                fill="none"
                stroke="#2f6e5a"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: '#62666d',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>{DateTime.fromISO(dayKeys[0]!).toFormat('LLL d')}</span>
              <span>{DateTime.fromISO(dayKeys[dayKeys.length - 1]!).toFormat('LLL d')}</span>
            </div>
          </div>
        </div>
        <div className={s.grid3}>
          <div className={s.card}>
            <span className={s.cardTitle}>Subscription distribution</span>
            <div className={s.dist}>
              {planDist.map((p) => (
                <span
                  key={p.p}
                  title={PLANS[p.p].label}
                  style={{
                    width: `${live.length ? (p.n / live.length) * 100 : 0}%`,
                    background: PLAN_COLOR[p.p],
                  }}
                />
              ))}
            </div>
            {planDist.map((p) => (
              <div key={p.p} className={s.distRow}>
                <i style={{ background: PLAN_COLOR[p.p] }} />
                <span>{PLANS[p.p].label}</span>
                <span>
                  {p.n} · {live.length ? Math.round((p.n / live.length) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
          <div className={s.card}>
            <span className={s.cardTitle}>Businesses by category</span>
            {cats.map((c) => (
              <div key={c.c} className={s.catRow}>
                <span>{categoryLabel(c.c)}</span>
                <span className={s.track}>
                  <span style={{ width: `${(c.n / cMax) * 100}%` }} />
                </span>
                <span>{c.n}</span>
              </div>
            ))}
          </div>
          <div className={s.card} style={{ gap: 10 }}>
            <span className={s.cardTitle}>Needs attention</span>
            {attention.length === 0 ? (
              <span className={s.muted}>Nothing needs attention.</span>
            ) : null}
            {attention.map((a) => (
              <Link
                key={a.t.id}
                className={s.attention}
                href={`/super-admin/businesses?open=${a.t.id}`}
              >
                <span>{a.t.name}</span>
                <span>{a.why}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
