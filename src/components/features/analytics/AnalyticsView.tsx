'use client';

import { useRouter } from 'next/navigation';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Card, Kpi, KpiGrid } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import t from '@/components/ui/Table.module.scss';
import o from '@/components/features/overview/Overview.module.scss';
import { hourLong, hourShort, moneyFmt, pct, WEEKDAYS } from '@/components/features/shared/format';
import type { Bucket, Totals } from '@/modules/analytics/aggregate';
import type { ResolvedRange } from '@/modules/analytics/service';

interface Props {
  rangeKey: string;
  range: ResolvedRange;
  granularity: 'hour' | 'day' | 'week' | 'month';
  filters: { staffId: string | null; serviceId: string | null };
  staff: { id: string; name: string }[];
  services: { id: string; name: string }[];
  cur: Totals;
  prev: Totals;
  collected: number;
  utilisation: number | null;
  series: (Bucket & { collectedMinor: number })[];
  popular: { name: string; count: number; share: number }[];
  peak: { hour: number; count: number }[];
  days: { weekday: number; average: number }[];
}

export function AnalyticsView(p: Props) {
  const { data } = useShell();
  const { slug, currency } = data.tenant;
  const router = useRouter();
  const base = `/app/${slug}/analytics`;
  const href = (patch: Record<string, string | null>) => {
    const cur: Record<string, string | null> = {
      range: p.rangeKey === '30d' ? null : p.rangeKey,
      from: p.rangeKey === 'custom' ? p.range.from : null,
      to: p.rangeKey === 'custom' ? p.range.to : null,
      by: null,
      staff: p.filters.staffId,
      svc: p.filters.serviceId,
      ...patch,
    };
    const qs = new URLSearchParams(
      Object.entries(cur).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `${base}?${qs}` : base;
  };
  const delta = (a: number, b: number) =>
    b
      ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}% vs previous period`
      : 'No data for previous period';

  const maxVol = Math.max(1, ...p.series.map((b) => b.volume));
  const maxMoney = Math.max(
    1,
    ...p.series.map((b) => Math.max(b.estimatedMinor, b.collectedMinor)),
  );
  const popMax = Math.max(1, ...p.popular.map((x) => x.count));
  const peakMax = Math.max(1, ...p.peak.map((x) => x.count));
  const dayMax = Math.max(0.0001, ...p.days.map((d) => d.average));
  const statusTotal = Math.max(1, p.cur.total);
  const breakdown = [
    ['Upcoming', p.cur.upcoming, '#e0773a'],
    ['Completed', p.cur.completed, '#2f6e5a'],
    ['Cancelled', p.cur.cancelled, '#b9b1a4'],
    ['No-show', p.cur.noShow, '#c4483a'],
  ] as const;

  return (
    <>
      <PageHeader title="Analytics" sub={`${p.range.from} – ${p.range.to} · ${data.tenant.name}`}>
        <Segmented
          label="Date range"
          items={[
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['90d', '90 days'],
            ['12m', '12 months'],
          ].map(([k, l]) => ({
            key: k!,
            label: l,
            selected: p.rangeKey === k,
            href: href({ range: k === '30d' ? null : k!, from: null, to: null }),
          }))}
        />
      </PageHeader>
      <PageContent>
        <div className={t.toolbar}>
          <select
            className={t.select}
            aria-label="Staff"
            value={p.filters.staffId ?? ''}
            onChange={(e) =>
              router.replace(href({ staff: e.target.value || null }), { scroll: false })
            }
          >
            <option value="">All staff</option>
            {p.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={t.select}
            aria-label="Service"
            value={p.filters.serviceId ?? ''}
            onChange={(e) =>
              router.replace(href({ svc: e.target.value || null }), { scroll: false })
            }
          >
            <option value="">All services</option>
            {p.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Segmented
            label="Group by"
            items={(['day', 'week', 'month'] as const).map((g) => ({
              key: g,
              label: `By ${g}`,
              selected: p.granularity === g,
              href: href({ by: g }),
            }))}
          />
        </div>

        <KpiGrid>
          <Kpi label="Booked" value={p.cur.booked} note={delta(p.cur.booked, p.prev.booked)} />
          <Kpi
            label="Completed"
            value={p.cur.completed}
            note={delta(p.cur.completed, p.prev.completed)}
          />
          <Kpi
            label="Estimated appointment value"
            value={moneyFmt(p.cur.estimatedMinor, currency)}
            note="Price × completed, not payments"
          />
          <Kpi
            label="Collected"
            value={moneyFmt(p.collected, currency)}
            note="Recorded payments minus refunds, by date recorded"
          />
          <Kpi
            label="Cancellation rate"
            value={pct(p.cur.cancellationRate)}
            note="Cancelled ÷ all booked"
          />
          <Kpi
            label="No-show rate"
            value={pct(p.cur.noShowRate)}
            note="No-shows ÷ (completed + no-shows)"
          />
          <Kpi
            label="Utilisation"
            value={pct(p.utilisation, 0)}
            note="Booked minutes ÷ staff working minutes"
          />
        </KpiGrid>

        <div className={o.chartCard}>
          <div className={o.chartHead}>
            <span style={{ fontWeight: 700 }}>Appointment volume</span>
            <span className={o.note}>
              Booked appointments by start date, excluding cancellations.
            </span>
          </div>
          <div className={o.bars} style={{ gap: p.series.length > 20 ? 3 : 8 }}>
            {p.series.map((b, i) => (
              <div
                key={b.key}
                className={o.barCol}
                title={`${b.tooltip}: ${b.volume} appointments`}
              >
                <span className={o.barTop}>
                  {p.series.length <= 14 && b.volume ? b.volume : ''}
                </span>
                <span
                  className={[o.barFill, i === p.series.length - 1 && o.barLast]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ height: `${(b.volume / maxVol) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className={o.labels} style={{ gap: p.series.length > 20 ? 3 : 8 }}>
            {p.series.map((b) => (
              <span key={b.key}>{b.label}</span>
            ))}
          </div>
        </div>

        <div className={o.chartCard}>
          <div className={o.chartHead}>
            <span style={{ fontWeight: 700 }}>Estimated vs collected</span>
            <span className={o.note} style={{ display: 'flex', gap: 12 }}>
              <span>
                <i
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    background: '#d9d1c3',
                    borderRadius: 2,
                  }}
                />{' '}
                Estimated (completed × price)
              </span>
              <span>
                <i
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    background: '#2f6e5a',
                    borderRadius: 2,
                  }}
                />{' '}
                Collected (recorded)
              </span>
            </span>
          </div>
          <div className={o.bars} style={{ gap: p.series.length > 20 ? 3 : 8 }}>
            {p.series.map((b) => (
              <div
                key={b.key}
                className={o.barCol}
                title={`${b.tooltip}: estimated ${moneyFmt(b.estimatedMinor, currency)}, collected ${moneyFmt(b.collectedMinor, currency)}`}
                style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}
              >
                <span
                  className={o.barFill}
                  style={{ height: `${(b.estimatedMinor / maxMoney) * 100}%` }}
                />
                <span
                  className={o.barFill}
                  style={{
                    height: `${(Math.max(0, b.collectedMinor) / maxMoney) * 100}%`,
                    background: '#2f6e5a',
                  }}
                />
              </div>
            ))}
          </div>
          <div className={o.labels} style={{ gap: p.series.length > 20 ? 3 : 8 }}>
            {p.series.map((b) => (
              <span key={b.key}>{b.label}</span>
            ))}
          </div>
          <span className={o.note}>
            Estimated value is attributed to the appointment date; collected money to the date it
            was recorded, so the two can fall in different periods.
          </span>
        </div>

        <div className={o.three}>
          <Card title="Status breakdown">
            {breakdown.map(([label, n, color]) => (
              <div key={label} className={o.popRow}>
                <span>{label}</span>
                <span className={o.track}>
                  <span
                    className={o.fill}
                    style={{ width: `${(n / statusTotal) * 100}%`, background: color }}
                  />
                </span>
                <span className={o.count}>{n}</span>
              </div>
            ))}
            <span className={o.note}>All appointments starting in the range ({p.cur.total}).</span>
          </Card>
          <Card title="Popular services">
            {p.popular.length === 0 ? (
              <span className={o.note}>No bookings in this range.</span>
            ) : null}
            {p.popular.map((x) => (
              <div key={x.name} className={o.popRow}>
                <span>{x.name}</span>
                <span className={o.track}>
                  <span className={o.fill} style={{ width: `${(x.count / popMax) * 100}%` }} />
                </span>
                <span className={o.count}>{Math.round(x.share * 100)}%</span>
              </div>
            ))}
            <span className={o.note}>Share of booked appointments, excluding cancellations.</span>
          </Card>
          <Card title="Peak hours">
            <div
              className={o.heat}
              style={{ gridTemplateColumns: `repeat(${p.peak.length}, minmax(0, 1fr))` }}
            >
              {p.peak.map((h) => {
                const v = h.count / peakMax;
                return (
                  <div
                    key={h.hour}
                    className={o.heatCell}
                    title={`${h.count} appointments starting ${hourLong(h.hour)}`}
                  >
                    <span
                      style={{
                        background: `oklch(${(0.96 - v * 0.5).toFixed(3)} ${(0.02 + v * 0.09).toFixed(3)} 160)`,
                      }}
                    />
                    <span>{hourShort(h.hour)}</span>
                  </div>
                );
              })}
            </div>
            <div className={o.days}>
              {p.days.map((d) => (
                <div
                  key={d.weekday}
                  className={o.dayCol}
                  title={`${WEEKDAYS[d.weekday - 1]}: ${d.average.toFixed(1)} per day`}
                >
                  <span
                    style={{ height: `${(d.average / dayMax) * 100}%`, background: '#d9d1c3' }}
                  />
                  <span>{WEEKDAYS[d.weekday - 1]![0]}</span>
                </div>
              ))}
            </div>
            <span className={o.note}>Starts by hour, and average appointments per weekday.</span>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
