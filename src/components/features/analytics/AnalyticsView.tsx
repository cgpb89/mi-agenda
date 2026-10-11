'use client';

import { useRouter } from 'next/navigation';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Card, Kpi, KpiGrid } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import tbl from '@/components/ui/Table.module.scss';
import o from '@/components/features/overview/Overview.module.scss';
import {
  fmtDate,
  hourLong,
  hourShort,
  moneyFmt,
  pct,
  weekdayNames,
} from '@/components/features/shared/format';
import type { Bucket, Totals } from '@/modules/analytics/aggregate';
import type { ResolvedRange } from '@/modules/analytics/service';
import { useI18n } from '@/i18n/client';
import { UpgradeCard } from '@/components/features/plans/UpgradeCard';
import type { PlanKey } from '@/modules/plans/features';

interface Props {
  /** Set when the plan lacks full analytics: short ranges only, no filters. */
  locked: { plan: PlanKey | null } | null;
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
  const { t, locale, intl } = useI18n();
  const an = t.analytics;
  const WEEKDAYS = weekdayNames(locale);
  const money = (minor: number) => moneyFmt(minor, currency, locale);
  const oneDecimal = (n: number) =>
    n.toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
      ? an.vsPrevious({ pct: `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` })
      : an.noPrevious;

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
    [an.upcoming, p.cur.upcoming, '#e0773a'],
    [an.completed, p.cur.completed, '#2f6e5a'],
    [an.cancelled, p.cur.cancelled, '#b9b1a4'],
    [an.noShow, p.cur.noShow, '#c4483a'],
  ] as const;

  return (
    <>
      <PageHeader
        title={t.app.nav.analytics}
        sub={`${fmtDate(p.range.from, locale, { month: 'short', day: 'numeric', year: 'numeric' })} – ${fmtDate(p.range.to, locale, { month: 'short', day: 'numeric', year: 'numeric' })} · ${data.tenant.name}`}
      >
        <Segmented
          label={an.dateRange}
          items={(p.locked ? (['7d', '30d'] as const) : (['7d', '30d', '90d', '12m'] as const)).map(
            (k) => ({
              key: k,
              label: an.ranges[k],
              selected: p.rangeKey === k,
              href: href({ range: k === '30d' ? null : k, from: null, to: null }),
            }),
          )}
        />
      </PageHeader>
      <PageContent>
        {p.locked ? <UpgradeCard plan={p.locked.plan} body={t.app.plans.analyticsLimited} /> : null}
        <div className={tbl.toolbar}>
          <select
            hidden={p.locked !== null}
            className={tbl.select}
            aria-label={an.staff}
            value={p.filters.staffId ?? ''}
            onChange={(e) =>
              router.replace(href({ staff: e.target.value || null }), { scroll: false })
            }
          >
            <option value="">{an.allStaff}</option>
            {p.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            hidden={p.locked !== null}
            className={tbl.select}
            aria-label={an.service}
            value={p.filters.serviceId ?? ''}
            onChange={(e) =>
              router.replace(href({ svc: e.target.value || null }), { scroll: false })
            }
          >
            <option value="">{an.allServices}</option>
            {p.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Segmented
            label={an.groupBy}
            items={(['day', 'week', 'month'] as const).map((g) => ({
              key: g,
              label: an.by[g],
              selected: p.granularity === g,
              href: href({ by: g }),
            }))}
          />
        </div>

        <KpiGrid>
          <Kpi label={an.booked} value={p.cur.booked} note={delta(p.cur.booked, p.prev.booked)} />
          <Kpi
            label={an.completed}
            value={p.cur.completed}
            note={delta(p.cur.completed, p.prev.completed)}
          />
          <Kpi
            label={an.estimatedValue}
            value={money(p.cur.estimatedMinor)}
            note={an.estimatedValueNote}
          />
          <Kpi label={an.collected} value={money(p.collected)} note={an.collectedNote} />
          <Kpi
            label={an.cancellationRate}
            value={pct(p.cur.cancellationRate, locale)}
            note={an.cancellationRateNote}
          />
          <Kpi
            label={an.noShowRate}
            value={pct(p.cur.noShowRate, locale)}
            note={an.noShowRateNote}
          />
          <Kpi
            label={an.utilisation}
            value={pct(p.utilisation, locale, 0)}
            note={an.utilisationNote}
          />
        </KpiGrid>

        <div className={o.chartCard}>
          <div className={o.chartHead}>
            <span style={{ fontWeight: 700 }}>{an.volume}</span>
            <span className={o.note}>{an.volumeNote}</span>
          </div>
          <div className={o.bars} style={{ gap: p.series.length > 20 ? 3 : 8 }}>
            {p.series.map((b, i) => (
              <div
                key={b.key}
                className={o.barCol}
                title={`${b.tooltip}: ${an.nAppointments({ n: b.volume })}`}
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
            <span style={{ fontWeight: 700 }}>{an.estVsCollected}</span>
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
                {an.estimatedLegend}
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
                {an.collectedLegend}
              </span>
            </span>
          </div>
          <div className={o.bars} style={{ gap: p.series.length > 20 ? 3 : 8 }}>
            {p.series.map((b) => (
              <div
                key={b.key}
                className={o.barCol}
                title={an.estVsCollectedTip({
                  date: b.tooltip,
                  est: money(b.estimatedMinor),
                  col: money(b.collectedMinor),
                })}
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
          <span className={o.note}>{an.estVsCollectedNote}</span>
        </div>

        <div className={o.three}>
          <Card title={an.statusBreakdown}>
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
            <span className={o.note}>{an.allInRange({ n: p.cur.total })}</span>
          </Card>
          <Card title={an.popular}>
            {p.popular.length === 0 ? <span className={o.note}>{an.noBookings}</span> : null}
            {p.popular.map((x) => (
              <div key={x.name} className={o.popRow}>
                <span>{x.name}</span>
                <span className={o.track}>
                  <span className={o.fill} style={{ width: `${(x.count / popMax) * 100}%` }} />
                </span>
                <span className={o.count}>{pct(x.share, locale, 0)}</span>
              </div>
            ))}
            <span className={o.note}>{an.shareNote}</span>
          </Card>
          <Card title={an.peakHours}>
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
                    title={an.startingAt({ n: h.count, hour: hourLong(h.hour, locale) })}
                  >
                    <span
                      style={{
                        background: `oklch(${(0.96 - v * 0.5).toFixed(3)} ${(0.02 + v * 0.09).toFixed(3)} 160)`,
                      }}
                    />
                    <span>{hourShort(h.hour, locale)}</span>
                  </div>
                );
              })}
            </div>
            <div className={o.days}>
              {p.days.map((d) => (
                <div
                  key={d.weekday}
                  className={o.dayCol}
                  title={an.perDay({ day: WEEKDAYS[d.weekday - 1]!, avg: oneDecimal(d.average) })}
                >
                  <span
                    style={{ height: `${(d.average / dayMax) * 100}%`, background: '#d9d1c3' }}
                  />
                  <span>{WEEKDAYS[d.weekday - 1]![0]}</span>
                </div>
              ))}
            </div>
            <span className={o.note}>{an.peakNote}</span>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
