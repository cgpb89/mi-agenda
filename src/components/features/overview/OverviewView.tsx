'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Card, EmptyState, Kpi, KpiGrid } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { StatusPill, STATUS_BAR_COLOR } from '@/components/ui/StatusPill';
import {
  fmtDate,
  fmtTime,
  hourLong,
  hourShort,
  moneyFmt,
  numFmt,
  pct,
  relDay,
  weekdayNames,
} from '@/components/features/shared/format';
import type { OverviewData } from '@/modules/analytics/service';
import { useOpenAppointment } from '@/components/features/appointments/AppointmentDrawer';
import { useNow } from '@/lib/hooks';
import styles from './Overview.module.scss';
import { useI18n } from '@/i18n/client';

const RANGES = ['today', '7d', '30d', '90d', 'custom'] as const;

export function OverviewView({
  data,
  canRevenue,
  setupNeeded,
}: {
  data: OverviewData;
  canRevenue: boolean;
  setupNeeded: { services: boolean; hours: boolean; published: boolean };
}) {
  const shell = useShell();
  const { tenant } = shell.data;
  const router = useRouter();
  const openAppt = useOpenAppointment();
  const base = `/app/${tenant.slug}`;
  const [chart, setChart] = useState<'rev' | 'vol'>(canRevenue ? 'rev' : 'vol');
  const k = data.kpi;
  const range = data.range;
  const nowMs = useNow();
  const { t, locale, intl } = useI18n();
  const ov = t.overview;
  const an = t.analytics;
  const WEEKDAYS = weekdayNames(locale);
  const signedPct = (p: number) => `${p >= 0 ? '+' : ''}${p}%`;

  const subtitle = `${fmtD(tenant.today, { weekday: 'long', month: 'long', day: 'numeric' })} · ${tenant.name}`;
  const rangeLabel = `${range.from === range.to ? '' : `${fmtD(range.from)} – `}${fmtD(range.to)}`;

  const completedNote = (() => {
    if (range.key === 'today' || !k.completedPrev) return ov.rangeNote({ range: rangeLabel });
    const p = Math.round(((k.completed - k.completedPrev) / k.completedPrev) * 100);
    return ov.vsPreviousDays({ pct: signedPct(p), days: range.days });
  })();
  const cancelNote =
    range.key === 'today'
      ? ov.cancelledToday({ n: k.todayCancelled })
      : k.cancellationRatePrev === null
        ? ov.cancelledShare
        : ov.cancelTrend({
            down: (k.cancellationRate ?? 0) <= k.cancellationRatePrev,
            prev: pct(k.cancellationRatePrev, locale),
          });

  const values = data.chart.map((b) => (chart === 'rev' ? b.estimatedMinor : b.volume));
  const max = Math.max(1, ...values);
  const showTop = data.chart.length <= 14;
  const gap = data.chart.length > 20 ? 3 : 8;

  const popMax = Math.max(1, ...data.popular.map((p) => p.count));
  const peakMax = Math.max(1, ...data.peak.map((p) => p.count));
  const peakTop = data.peak.reduce(
    (a, b) => (b.count > a.count ? b : a),
    data.peak[0] ?? { hour: 9, count: 0 },
  );
  const dayMax = Math.max(0.0001, ...data.days.map((d) => d.average));
  const dayTop = data.days.reduce(
    (a, b) => (b.average > a.average ? b : a),
    data.days[0] ?? { weekday: 1, average: 0 },
  );
  const closedDays = data.days.filter((d) => d.average === 0).map((d) => WEEKDAYS[d.weekday - 1]);

  function setCustom(from: string, to: string) {
    router.replace(`${base}/overview?range=custom&from=${from}&to=${to}`, { scroll: false });
  }

  const header = (
    <PageHeader title={ov.title} sub={subtitle}>
      <Segmented
        label={an.dateRange}
        items={RANGES.map((key) => ({
          key,
          label: an.ranges[key],
          selected: range.key === key,
          href:
            key === 'custom'
              ? `${base}/overview?range=custom&from=${range.from}&to=${range.to}`
              : `${base}/overview?range=${key}`,
        }))}
      />
    </PageHeader>
  );

  const customBar =
    range.key === 'custom' ? (
      <div className={styles.customBar}>
        <span style={{ fontWeight: 600 }}>{an.customRange}</span>
        <input
          type="date"
          aria-label={an.from}
          defaultValue={range.from}
          max={range.to}
          onChange={(e) => e.target.value && setCustom(e.target.value, range.to)}
        />
        <span>{an.toWord}</span>
        <input
          type="date"
          aria-label={an.to}
          defaultValue={range.to}
          min={range.from}
          onChange={(e) => e.target.value && setCustom(range.from, e.target.value)}
        />
      </div>
    ) : null;

  if (!data.hasAnyData) {
    return (
      <>
        {header}
        <PageContent>
          <EmptyState
            eyebrow={setupNeeded.published ? ov.eyebrowLive : ov.eyebrowDraft}
            title={ov.emptyTitle}
            actions={
              <>
                {setupNeeded.hours ? (
                  <ButtonLink href={`${base}/availability`} variant="primary">
                    {ov.setHours}
                  </ButtonLink>
                ) : null}
                {setupNeeded.services ? (
                  <ButtonLink
                    href={`${base}/services?new=1`}
                    variant={setupNeeded.hours ? 'secondary' : 'primary'}
                  >
                    {ov.addService}
                  </ButtonLink>
                ) : null}
                {!setupNeeded.published ? (
                  <ButtonLink href={`${base}/booking-page`}>{ov.publishPage}</ButtonLink>
                ) : null}
                {shell.data.booking ? (
                  <Button onClick={() => shell.openNewAppointment()}>{ov.newAppointment}</Button>
                ) : null}
              </>
            }
          >
            {setupNeeded.published
              ? ov.emptyLive({ business: tenant.name })
              : ov.emptyDraft({ business: tenant.name })}
          </EmptyState>
        </PageContent>
      </>
    );
  }

  return (
    <>
      {header}
      {customBar}
      <PageContent>
        <div className={styles.quick}>
          {shell.data.booking ? (
            <Button pill onClick={() => shell.openNewAppointment()}>
              {ov.newAppointment}
            </Button>
          ) : null}
          <ButtonLink pill href={`${base}/services?new=1`}>
            {ov.quickAddService}
          </ButtonLink>
          <ButtonLink pill href={`${base}/availability`}>
            {ov.quickAvailability}
          </ButtonLink>
        </div>

        <KpiGrid>
          <Kpi
            label={ov.todayCount}
            value={k.todayCount}
            note={ov.todayNote({ done: k.todayDone, toCome: k.todayToCome })}
          />
          <Kpi label={ov.upcoming} value={k.upcoming} note={ov.pendingNote({ n: k.pending })} />
          <Kpi label={ov.completed} value={numFmt(k.completed, locale)} note={completedNote} />
          {canRevenue ? (
            <>
              <Kpi
                label={ov.estimatedRevenue}
                value={moneyFmt(k.estimatedMinor, tenant.currency, locale)}
                note={ov.estimatedRevenueNote}
              />
              <Kpi
                label={ov.collected}
                value={moneyFmt(k.collectedMinor, tenant.currency, locale)}
                note={ov.collectedNote}
              />
            </>
          ) : null}
          <Kpi
            label={ov.cancellationRate}
            value={pct(k.cancellationRate, locale)}
            note={cancelNote}
          />
        </KpiGrid>

        <div className={styles.two}>
          <Card
            title={ov.todaySchedule}
            action={{
              href: `${base}/calendar?view=day&date=${tenant.today}`,
              label: ov.openCalendar,
            }}
            flush
          >
            <div className={styles.list}>
              {data.today.length === 0 ? (
                <div className={styles.emptyList}>{ov.nothingToday}</div>
              ) : null}
              {data.today.map((a) => {
                const start = new Date(a.startAt).getTime();
                const now = start <= nowMs && new Date(a.endAt).getTime() > nowMs;
                return (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => openAppt(a.id)}
                    className={[styles.row, now && styles.rowNow].filter(Boolean).join(' ')}
                  >
                    <span className={styles.time}>
                      {fmtTime(a.startAt, tenant.timezone, locale)}
                    </span>
                    <span
                      className={styles.bar}
                      style={{ background: STATUS_BAR_COLOR[a.status] }}
                    />
                    <span className={styles.who}>
                      <span>{a.contactName}</span>
                      <span>
                        {a.serviceNameSnapshot} · {a.staff.displayName.split(' ')[0]}
                      </span>
                    </span>
                    <StatusPill status={a.status} size="sm" />
                  </button>
                );
              })}
            </div>
          </Card>
          <Card
            title={ov.comingUp}
            action={{ href: `${base}/appointments`, label: ov.allAppointments }}
            flush
          >
            <div>
              {data.upcoming.length === 0 ? (
                <div className={styles.emptyList}>{ov.noUpcoming}</div>
              ) : null}
              {data.upcoming.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => openAppt(a.id)}
                  className={[styles.row, styles.upRow].join(' ')}
                >
                  <span className={styles.day}>
                    <span>{relDay(a.startAt, tenant.timezone, tenant.today, locale)}</span>
                    <span>{fmtTime(a.startAt, tenant.timezone, locale)}</span>
                  </span>
                  <span className={styles.who}>
                    <span>{a.contactName}</span>
                    <span>
                      {a.serviceNameSnapshot} · {a.staff.displayName}
                    </span>
                  </span>
                  <StatusPill status={a.status} size="sm" />
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartHead}>
            <div role="tablist" className={styles.tabs}>
              {canRevenue ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={chart === 'rev'}
                  className={[styles.tab, chart === 'rev' && styles.tabOn]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setChart('rev')}
                >
                  {ov.revenueTab}
                </button>
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={chart === 'vol'}
                className={[styles.tab, chart === 'vol' && styles.tabOn].filter(Boolean).join(' ')}
                onClick={() => setChart('vol')}
              >
                {ov.volumeTab}
              </button>
            </div>
            <span className={styles.note}>{chart === 'rev' ? ov.revenueNote : ov.volumeNote}</span>
          </div>
          <div
            className={styles.bars}
            style={{ gap }}
            role="img"
            aria-label={chart === 'rev' ? ov.revenueChart : ov.volumeChart}
          >
            {data.chart.map((b, i) => {
              const v = values[i]!;
              const shown = chart === 'rev' ? moneyFmt(v, tenant.currency, locale) : String(v);
              return (
                <div
                  key={b.key}
                  className={styles.barCol}
                  title={`${b.tooltip}: ${chart === 'rev' ? shown : an.nAppointments({ n: v })}`}
                >
                  <span className={styles.barTop}>{showTop && v > 0 ? shown : ''}</span>
                  <span
                    className={[styles.barFill, i === data.chart.length - 1 && styles.barLast]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ height: `${(v / max) * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className={styles.labels} style={{ gap }}>
            {data.chart.map((b) => (
              <span key={b.key}>{b.label}</span>
            ))}
          </div>
        </div>

        <div className={styles.three}>
          <Card title={ov.popular}>
            {data.popular.length === 0 ? (
              <span className={styles.note}>{an.noBookings}</span>
            ) : null}
            {data.popular.map((p) => (
              <div key={p.name} className={styles.popRow}>
                <span>{p.name}</span>
                <span className={styles.track}>
                  <span className={styles.fill} style={{ width: `${(p.count / popMax) * 100}%` }} />
                </span>
                <span className={styles.count}>{p.count}</span>
              </div>
            ))}
            <span className={styles.note}>{ov.popularNote}</span>
          </Card>
          <Card title={ov.peakHours}>
            <div
              className={styles.heat}
              style={{ gridTemplateColumns: `repeat(${data.peak.length}, minmax(0, 1fr))` }}
            >
              {data.peak.map((h) => {
                const v = h.count / peakMax;
                return (
                  <div
                    key={h.hour}
                    className={styles.heatCell}
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
            <span className={styles.note}>
              {ov.peakNote}
              {peakTop && peakTop.count > 0
                ? ov.busiestAt({ hour: hourLong(peakTop.hour, locale) })
                : ''}
            </span>
          </Card>
          <Card title={ov.busiestDays}>
            <div className={styles.days}>
              {data.days.map((d) => (
                <div
                  key={d.weekday}
                  className={styles.dayCol}
                  title={an.perDay({ day: WEEKDAYS[d.weekday - 1]!, avg: oneDecimal(d.average) })}
                >
                  <span
                    style={{
                      height: `${(d.average / dayMax) * 100}%`,
                      background:
                        d.weekday === dayTop.weekday && d.average > 0 ? '#e0773a' : '#d9d1c3',
                    }}
                  />
                  <span>{WEEKDAYS[d.weekday - 1]![0]}</span>
                </div>
              ))}
            </div>
            <span className={styles.note}>
              {ov.daysNote}
              {dayTop.average > 0
                ? ov.dayLeads({
                    day: WEEKDAYS[dayTop.weekday - 1]!,
                    avg: oneDecimal(dayTop.average),
                  })
                : ''}
              {closedDays.length && dayTop.average > 0
                ? ov.hadNone({ days: closedDays.join(', ') })
                : dayTop.average > 0
                  ? '.'
                  : ''}
            </span>
          </Card>
        </div>
      </PageContent>
    </>
  );

  function fmtD(iso: string, opts?: Intl.DateTimeFormatOptions) {
    return fmtDate(iso, locale, opts);
  }

  function oneDecimal(n: number) {
    return n.toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
}
