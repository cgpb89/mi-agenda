'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Card, EmptyState, Kpi, KpiGrid } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { StatusPill, STATUS_BAR_COLOR } from '@/components/ui/StatusPill';
import {
  fmtTime,
  hourLong,
  hourShort,
  moneyFmt,
  pct,
  relDay,
  WEEKDAYS,
} from '@/components/features/shared/format';
import type { OverviewData } from '@/modules/analytics/service';
import { useOpenAppointment } from '@/components/features/appointments/AppointmentDrawer';
import { useNow } from '@/lib/hooks';
import styles from './Overview.module.scss';

const RANGES = [
  ['today', 'Today'],
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['90d', '90 days'],
  ['custom', 'Custom'],
] as const;

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

  const subtitle = `${new Date(`${tenant.today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })} · ${tenant.name}`;
  const rangeLabel = `${range.from === range.to ? '' : `${fmtD(range.from)} – `}${fmtD(range.to)}`;

  const completedNote = (() => {
    if (range.key === 'today' || !k.completedPrev) return `Range: ${rangeLabel}`;
    const p = Math.round(((k.completed - k.completedPrev) / k.completedPrev) * 100);
    return `${p >= 0 ? '+' : ''}${p}% vs previous ${range.days} days`;
  })();
  const cancelNote =
    range.key === 'today'
      ? `${k.todayCancelled} cancelled today`
      : k.cancellationRatePrev === null
        ? 'Cancelled ÷ all booked in range'
        : `${(k.cancellationRate ?? 0) <= k.cancellationRatePrev ? 'Down' : 'Up'} from ${pct(k.cancellationRatePrev)} previous period`;

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
    <PageHeader title="Overview" sub={subtitle}>
      <Segmented
        label="Date range"
        items={RANGES.map(([key, label]) => ({
          key,
          label,
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
        <span style={{ fontWeight: 600 }}>Custom range</span>
        <input
          type="date"
          aria-label="From"
          defaultValue={range.from}
          max={range.to}
          onChange={(e) => e.target.value && setCustom(e.target.value, range.to)}
        />
        <span>to</span>
        <input
          type="date"
          aria-label="To"
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
            eyebrow={setupNeeded.published ? 'BOOKING PAGE · LIVE' : 'NEW BUSINESS · DRAFT'}
            title="No appointments yet"
            actions={
              <>
                {setupNeeded.hours ? (
                  <ButtonLink href={`${base}/availability`} variant="primary">
                    Set working hours
                  </ButtonLink>
                ) : null}
                {setupNeeded.services ? (
                  <ButtonLink
                    href={`${base}/services?new=1`}
                    variant={setupNeeded.hours ? 'secondary' : 'primary'}
                  >
                    Add a service
                  </ButtonLink>
                ) : null}
                {!setupNeeded.published ? (
                  <ButtonLink href={`${base}/booking-page`}>Publish your booking page</ButtonLink>
                ) : null}
                {shell.data.booking ? (
                  <Button onClick={() => shell.openNewAppointment()}>New appointment</Button>
                ) : null}
              </>
            }
          >
            {setupNeeded.published
              ? `${tenant.name}'s booking page is live. New bookings and charts appear here as soon as customers book.`
              : `Once ${tenant.name}'s services, hours and booking page are set up and published, appointments and charts appear here.`}
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
              New appointment
            </Button>
          ) : null}
          <ButtonLink pill href={`${base}/services?new=1`}>
            Add service
          </ButtonLink>
          <ButtonLink pill href={`${base}/availability`}>
            Edit availability
          </ButtonLink>
        </div>

        <KpiGrid>
          <Kpi
            label="Today's appointments"
            value={k.todayCount}
            note={`${k.todayDone} done · ${k.todayToCome} still to come`}
          />
          <Kpi label="Upcoming" value={k.upcoming} note={`${k.pending} pending confirmation`} />
          <Kpi label="Completed" value={k.completed.toLocaleString()} note={completedNote} />
          {canRevenue ? (
            <>
              <Kpi
                label="Estimated revenue"
                value={moneyFmt(k.estimatedMinor, tenant.currency)}
                note="Price of completed appointments"
              />
              <Kpi
                label="Revenue collected"
                value={moneyFmt(k.collectedMinor, tenant.currency)}
                note="Payments recorded in range, minus refunds"
              />
            </>
          ) : null}
          <Kpi label="Cancellation rate" value={pct(k.cancellationRate)} note={cancelNote} />
        </KpiGrid>

        <div className={styles.two}>
          <Card
            title="Today's schedule"
            action={{
              href: `${base}/calendar?view=day&date=${tenant.today}`,
              label: 'Open calendar →',
            }}
            flush
          >
            <div className={styles.list}>
              {data.today.length === 0 ? (
                <div className={styles.emptyList}>Nothing booked today.</div>
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
                    <span className={styles.time}>{fmtTime(a.startAt, tenant.timezone)}</span>
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
            title="Coming up"
            action={{ href: `${base}/appointments`, label: 'All appointments →' }}
            flush
          >
            <div>
              {data.upcoming.length === 0 ? (
                <div className={styles.emptyList}>No upcoming appointments.</div>
              ) : null}
              {data.upcoming.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => openAppt(a.id)}
                  className={[styles.row, styles.upRow].join(' ')}
                >
                  <span className={styles.day}>
                    <span>{relDay(a.startAt, tenant.timezone, tenant.today)}</span>
                    <span>{fmtTime(a.startAt, tenant.timezone)}</span>
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
                  Estimated revenue
                </button>
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={chart === 'vol'}
                className={[styles.tab, chart === 'vol' && styles.tabOn].filter(Boolean).join(' ')}
                onClick={() => setChart('vol')}
              >
                Appointment volume
              </button>
            </div>
            <span className={styles.note}>
              {chart === 'rev'
                ? 'Price of completed appointments. Not collected payments.'
                : 'Booked appointments, excluding cancellations.'}
            </span>
          </div>
          <div
            className={styles.bars}
            style={{ gap }}
            role="img"
            aria-label={chart === 'rev' ? 'Estimated revenue chart' : 'Appointment volume chart'}
          >
            {data.chart.map((b, i) => {
              const v = values[i]!;
              const shown = chart === 'rev' ? moneyFmt(v, tenant.currency) : String(v);
              return (
                <div
                  key={b.key}
                  className={styles.barCol}
                  title={`${b.tooltip}: ${chart === 'rev' ? shown : `${v} appointments`}`}
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
          <Card title="Popular services">
            {data.popular.length === 0 ? (
              <span className={styles.note}>No bookings in this range.</span>
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
            <span className={styles.note}>
              Booked appointments in range, excluding cancellations.
            </span>
          </Card>
          <Card title="Peak booking hours">
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
            <span className={styles.note}>
              Appointments by start hour.
              {peakTop && peakTop.count > 0 ? ` Busiest: ${hourLong(peakTop.hour)}.` : ''}
            </span>
          </Card>
          <Card title="Busiest days">
            <div className={styles.days}>
              {data.days.map((d) => (
                <div
                  key={d.weekday}
                  className={styles.dayCol}
                  title={`${WEEKDAYS[d.weekday - 1]}: ${d.average.toFixed(1)} per day`}
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
              Average appointments per day.
              {dayTop.average > 0
                ? ` ${WEEKDAYS[dayTop.weekday - 1]} leads with ${dayTop.average.toFixed(1)}`
                : ''}
              {closedDays.length && dayTop.average > 0
                ? `; ${closedDays.join(', ')} had none.`
                : dayTop.average > 0
                  ? '.'
                  : ''}
            </span>
          </Card>
        </div>
      </PageContent>
    </>
  );

  function fmtD(iso: string) {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }
}
