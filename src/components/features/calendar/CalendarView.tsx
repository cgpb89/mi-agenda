'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { buttonClass } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { STATUS_BAR_COLOR, STATUS_BG, type AppointmentStatusKey } from '@/components/ui/StatusPill';
import tableStyles from '@/components/ui/Table.module.scss';
import { hourShort, localMinutes, weekdayNames } from '@/components/features/shared/format';
import { addDaysIso, fmtMin, labelDate } from '@/components/features/appointments/time-options';
import { useOpenAppointment } from '@/components/features/appointments/AppointmentDrawer';
import styles from './Calendar.module.scss';
import { useI18n } from '@/i18n/client';

interface Range {
  start: number;
  end: number;
}

export interface CalItem {
  id: string;
  startMin: number;
  endMin: number;
  status: AppointmentStatusKey;
  customer: string;
  service: string;
}

export interface CalDay {
  date: string;
  isToday: boolean;
  inMonth: boolean;
  lanes: {
    staffId: string;
    shifts: Range[];
    blocks: (Range & { label: string | null })[];
    items: CalItem[];
  }[];
}

const HOUR_PX = 56;

function initials(name: string) {
  return name
    .replace(/^Dr\.\s+/, '')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 3);
}

export function CalendarView({
  view,
  anchor,
  days,
  staff,
  allStaff,
  selectedStaff,
  services,
  serviceId,
  statusKey,
  hours,
}: {
  view: 'day' | 'week' | 'month';
  anchor: string;
  days: CalDay[];
  staff: { id: string; name: string }[];
  allStaff: { id: string; name: string }[];
  selectedStaff: string[];
  services: { id: string; name: string }[];
  serviceId: string | null;
  statusKey: string;
  hours: [number, number];
}) {
  const shell = useShell();
  const { tenant } = shell.data;
  const router = useRouter();
  const openAppt = useOpenAppointment();
  const base = `/app/${tenant.slug}/calendar`;
  const { t, locale } = useI18n();
  const cal = t.calendar;
  const WD = weekdayNames(locale, 'short');
  const fmt = (m: number) => fmtMin(m, locale);
  const dateLabel = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
    labelDate(iso, locale, opts);

  const href = (patch: Record<string, string | null>) => {
    const cur: Record<string, string | null> = {
      view,
      date: anchor,
      staff: selectedStaff.join(',') || null,
      svc: serviceId,
      status: statusKey === 'active' ? null : statusKey,
      ...patch,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    return `${base}?${p.toString()}`;
  };

  const step = view === 'day' ? 1 : view === 'week' ? 7 : 0;
  const prev =
    view === 'month'
      ? (() => {
          const d = new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`);
          d.setUTCMonth(d.getUTCMonth() - 1);
          return d.toISOString().slice(0, 10);
        })()
      : addDaysIso(anchor, -step);
  const next =
    view === 'month'
      ? (() => {
          const d = new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`);
          d.setUTCMonth(d.getUTCMonth() + 1);
          return d.toISOString().slice(0, 10);
        })()
      : addDaysIso(anchor, step);

  const label =
    view === 'day'
      ? dateLabel(anchor, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : view === 'week'
        ? `${dateLabel(days[0]!.date, { month: 'short', day: 'numeric' })} – ${dateLabel(days[6]!.date, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : dateLabel(anchor, { month: 'long', year: 'numeric' });

  const [H0, H1] = hours;
  const total = ((H1 - H0) / 60) * HOUR_PX;
  const y = (m: number) => ((Math.min(Math.max(m, H0), H1) - H0) / 60) * HOUR_PX;
  const laneW = view === 'day' ? 160 : 44;
  const minW = 56 + days.length * Math.max(1, staff.length) * laneW;
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;
  const nowMin = localMinutes(new Date(), tenant.timezone);

  function toggleStaff(id: string | null) {
    if (id === null) return router.replace(href({ staff: null }), { scroll: false });
    const set = new Set(selectedStaff);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    router.replace(href({ staff: [...set].join(',') || null }), { scroll: false });
  }

  function laneShades(lane: CalDay['lanes'][number]) {
    const out: { top: number; h: number; cls: string; text?: string; title: string }[] = [];
    if (lane.shifts.length === 0) {
      out.push({
        top: 0,
        h: total,
        cls: styles.off!,
        text: view === 'day' ? cal.notWorking : undefined,
        title: cal.notWorking,
      });
      return out;
    }
    const first = lane.shifts[0]!.start;
    const last = lane.shifts[lane.shifts.length - 1]!.end;
    if (first > H0) out.push({ top: 0, h: y(first), cls: styles.off!, title: cal.notWorking });
    if (last < H1)
      out.push({ top: y(last), h: total - y(last), cls: styles.off!, title: cal.notWorking });
    for (let i = 1; i < lane.shifts.length; i++) {
      const a = lane.shifts[i - 1]!.end;
      const b = lane.shifts[i]!.start;
      if (b > a) out.push({ top: y(a), h: y(b) - y(a), cls: styles.brk!, title: cal.break });
    }
    for (const b of lane.blocks) {
      const text = b.label ? cal.blockedWith({ label: b.label }) : cal.blocked;
      out.push({ top: y(b.start), h: y(b.end) - y(b.start), cls: styles.blk!, text, title: text });
    }
    return out;
  }

  return (
    <>
      <PageHeader
        title={t.app.nav.calendar}
        sub={cal.sub({
          business: tenant.name,
          zone: tenant.timezone.split('/').pop()?.replace(/_/g, ' ') ?? tenant.timezone,
        })}
      />
      <PageContent>
        <div className={styles.toolbar}>
          <Link
            href={href({ date: tenant.today })}
            className={buttonClass({ variant: 'primary', size: 'sm' })}
            scroll={false}
          >
            {cal.today}
          </Link>
          <div style={{ display: 'flex', gap: 4 }}>
            <Link
              aria-label={cal.previous}
              className={styles.navBtn}
              href={href({ date: prev })}
              scroll={false}
            >
              ‹
            </Link>
            <Link
              aria-label={cal.next}
              className={styles.navBtn}
              href={href({ date: next })}
              scroll={false}
            >
              ›
            </Link>
          </div>
          <span className={styles.label}>{label}</span>
          <Segmented
            label={cal.view}
            items={(['day', 'week', 'month'] as const).map((v) => ({
              key: v,
              label: cal.views[v],
              selected: view === v,
              href: href({ view: v }),
            }))}
          />
        </div>

        <div className={styles.filters}>
          <span className={styles.filterLabel}>{cal.staff}</span>
          <button
            type="button"
            onClick={() => toggleStaff(null)}
            aria-pressed={selectedStaff.length === 0}
            className={[tableStyles.chip, selectedStaff.length === 0 && tableStyles.chipOn]
              .filter(Boolean)
              .join(' ')}
          >
            {cal.everyone}
          </button>
          {allStaff.map((s) => {
            const on = selectedStaff.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleStaff(s.id)}
                aria-pressed={on}
                className={[tableStyles.chip, on && tableStyles.chipOn].filter(Boolean).join(' ')}
              >
                {s.name}
              </button>
            );
          })}
          <span className={styles.sep} />
          <select
            className={styles.select}
            aria-label={cal.serviceFilter}
            value={serviceId ?? 'all'}
            onChange={(e) =>
              router.replace(href({ svc: e.target.value === 'all' ? null : e.target.value }), {
                scroll: false,
              })
            }
          >
            <option value="all">{cal.allServices}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            aria-label={cal.statusFilter}
            value={statusKey}
            onChange={(e) =>
              router.replace(
                href({ status: e.target.value === 'active' ? null : e.target.value }),
                { scroll: false },
              )
            }
          >
            {(['active', 'all', 'pending', 'confirmed', 'completed', 'noshow'] as const).map(
              (k) => (
                <option key={k} value={k}>
                  {cal.statuses[k]}
                </option>
              ),
            )}
          </select>
        </div>

        {view !== 'month' ? (
          <>
            <div className={styles.legend}>
              <span>
                <span
                  className={styles.sw}
                  style={{ background: '#fff', border: '1px solid #d9d3c8' }}
                />
                {cal.available}
              </span>
              <span>
                <span
                  className={styles.sw}
                  style={{ background: '#fbe6d8', borderLeft: '3px solid #e0773a' }}
                />
                {cal.booked}
              </span>
              <span>
                <span className={[styles.sw, styles.brk].join(' ')} />
                {cal.break}
              </span>
              <span>
                <span className={[styles.sw, styles.blk].join(' ')} />
                {cal.blocked}
              </span>
              <span>
                <span className={[styles.sw, styles.off].join(' ')} />
                {cal.notWorking}
              </span>
              {shell.data.booking ? <span className={styles.hint}>{cal.clickToBook}</span> : null}
            </div>
            <div className={styles.gridWrap} data-tour="calendar-grid">
              <div style={{ minWidth: minW }}>
                <div className={styles.head} style={{ gridTemplateColumns: cols }}>
                  <span />
                  {days.map((d) => (
                    <div key={d.date} className={styles.dayHead}>
                      <span style={{ color: d.isToday ? '#c4581f' : undefined }}>
                        {dateLabel(d.date)}
                        {d.isToday ? cal.todaySuffix : ''}
                      </span>
                      <div className={styles.laneHeads}>
                        {staff.map((s) => (
                          <span key={s.id} title={s.name}>
                            {view === 'day' ? s.name : initials(s.name)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.body} style={{ gridTemplateColumns: cols }}>
                  <div className={styles.gutter} style={{ height: total }}>
                    {Array.from({ length: (H1 - H0) / 60 }, (_, i) => {
                      const h = H0 / 60 + i;
                      return (
                        <span key={h} style={{ top: i * HOUR_PX + (i === 0 ? 8 : 0) }}>
                          {hourShort(h, locale)}
                        </span>
                      );
                    })}
                  </div>
                  {days.map((d) => (
                    <div
                      key={d.date}
                      className={styles.dayCol}
                      style={{
                        height: total,
                        backgroundImage: `repeating-linear-gradient(180deg, #f2efe9 0 1px, transparent 1px ${HOUR_PX}px)`,
                      }}
                    >
                      {d.lanes.map((lane) => (
                        <div
                          key={lane.staffId}
                          className={styles.lane}
                          style={{ cursor: shell.data.booking ? 'copy' : 'default' }}
                          onClick={(e) => {
                            if (!shell.data.booking || e.target !== e.currentTarget) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const m =
                              H0 + Math.floor((((e.clientY - rect.top) / HOUR_PX) * 60) / 15) * 15;
                            shell.openNewAppointment({
                              staffId: lane.staffId,
                              date: d.date < tenant.today ? tenant.today : d.date,
                              startMin: Math.min(m, H1 - 30),
                            });
                          }}
                        >
                          {laneShades(lane).map((sh, i) => (
                            <div
                              key={i}
                              title={sh.title}
                              className={[styles.shade, sh.cls].join(' ')}
                              style={{ top: sh.top, height: sh.h }}
                            >
                              {sh.text}
                            </div>
                          ))}
                          {lane.items.map((it) => {
                            const cancelled = it.status === 'CANCELLED';
                            return (
                              <button
                                key={it.id}
                                type="button"
                                title={`${it.customer} · ${it.service} · ${fmt(it.startMin)}–${fmt(it.endMin)} · ${staff.find((s) => s.id === lane.staffId)?.name} · ${t.common.status[it.status]}`}
                                className={[styles.item, cancelled && styles.cancelled]
                                  .filter(Boolean)
                                  .join(' ')}
                                style={{
                                  top: y(it.startMin) + 2,
                                  height: Math.max(18, y(it.endMin) - y(it.startMin) - 4),
                                  borderLeftColor: STATUS_BAR_COLOR[it.status],
                                  background: STATUS_BG[it.status],
                                }}
                                onClick={() => openAppt(it.id)}
                              >
                                <span>{fmt(it.startMin)}</span>
                                <span>{it.customer}</span>
                                <span>{it.service}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                      {d.isToday && nowMin >= H0 && nowMin <= H1 ? (
                        <div className={styles.now} style={{ top: y(nowMin) }} />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.month}>
            <div className={styles.monthHead}>
              {WD.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className={styles.monthGrid}>
              {days.map((d) => {
                const items = d.lanes
                  .flatMap((l) => l.items)
                  .sort((a, b) => a.startMin - b.startMin);
                return (
                  <Link
                    key={d.date}
                    href={href({ view: 'day', date: d.date })}
                    className={[
                      styles.cell,
                      d.isToday && styles.cellToday,
                      !d.inMonth && styles.cellOut,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className={styles.cellTop}>
                      <span
                        className={[styles.num, d.isToday && styles.numToday]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {Number(d.date.slice(8))}
                      </span>
                      <span>{items.length ? cal.nAppts({ n: items.length }) : ''}</span>
                    </span>
                    {items.slice(0, 3).map((i) => (
                      <span
                        key={i.id}
                        className={styles.chip}
                        style={{ background: STATUS_BG[i.status], color: '#1c1a17' }}
                      >
                        {fmt(i.startMin).replace(':00', '').replace(' AM', 'a').replace(' PM', 'p')}{' '}
                        {i.customer}
                      </span>
                    ))}
                    {items.length > 3 ? (
                      <span className={styles.more}>{cal.more({ n: items.length - 3 })}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </PageContent>
    </>
  );
}
