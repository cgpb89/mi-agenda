'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { buttonClass } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { APPOINTMENT_STATUS_LABEL, STATUS_BAR_COLOR, STATUS_BG } from '@/components/ui/StatusPill';
import tableStyles from '@/components/ui/Table.module.scss';
import { localMinutes } from '@/components/features/shared/format';
import { addDaysIso, fmtMin, labelDate } from '@/components/features/appointments/time-options';
import { useOpenAppointment } from '@/components/features/appointments/AppointmentDrawer';
import styles from './Calendar.module.scss';

interface Range {
  start: number;
  end: number;
}

export interface CalItem {
  id: string;
  startMin: number;
  endMin: number;
  status: keyof typeof APPOINTMENT_STATUS_LABEL;
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
    blocks: (Range & { label: string })[];
    items: CalItem[];
  }[];
}

const HOUR_PX = 56;
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
      ? labelDate(anchor, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : view === 'week'
        ? `${labelDate(days[0]!.date, { month: 'short', day: 'numeric' })} – ${labelDate(days[6]!.date, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : labelDate(anchor, { month: 'long', year: 'numeric' });

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
        text: view === 'day' ? 'Not working' : undefined,
        title: 'Not working',
      });
      return out;
    }
    const first = lane.shifts[0]!.start;
    const last = lane.shifts[lane.shifts.length - 1]!.end;
    if (first > H0) out.push({ top: 0, h: y(first), cls: styles.off!, title: 'Not working' });
    if (last < H1)
      out.push({ top: y(last), h: total - y(last), cls: styles.off!, title: 'Not working' });
    for (let i = 1; i < lane.shifts.length; i++) {
      const a = lane.shifts[i - 1]!.end;
      const b = lane.shifts[i]!.start;
      if (b > a) out.push({ top: y(a), h: y(b) - y(a), cls: styles.brk!, title: 'Break' });
    }
    for (const b of lane.blocks)
      out.push({
        top: y(b.start),
        h: y(b.end) - y(b.start),
        cls: styles.blk!,
        text: `Blocked · ${b.label}`,
        title: `Blocked · ${b.label}`,
      });
    return out;
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        sub={`${tenant.name} · ${tenant.timezone.split('/').pop()?.replace(/_/g, ' ')} time`}
      />
      <PageContent>
        <div className={styles.toolbar}>
          <Link
            href={href({ date: tenant.today })}
            className={buttonClass({ variant: 'primary', size: 'sm' })}
            scroll={false}
          >
            Today
          </Link>
          <div style={{ display: 'flex', gap: 4 }}>
            <Link
              aria-label="Previous"
              className={styles.navBtn}
              href={href({ date: prev })}
              scroll={false}
            >
              ‹
            </Link>
            <Link
              aria-label="Next"
              className={styles.navBtn}
              href={href({ date: next })}
              scroll={false}
            >
              ›
            </Link>
          </div>
          <span className={styles.label}>{label}</span>
          <Segmented
            label="View"
            items={(['day', 'week', 'month'] as const).map((v) => ({
              key: v,
              label: v[0]!.toUpperCase() + v.slice(1),
              selected: view === v,
              href: href({ view: v }),
            }))}
          />
        </div>

        <div className={styles.filters}>
          <span className={styles.filterLabel}>Staff</span>
          <button
            type="button"
            onClick={() => toggleStaff(null)}
            aria-pressed={selectedStaff.length === 0}
            className={[tableStyles.chip, selectedStaff.length === 0 && tableStyles.chipOn]
              .filter(Boolean)
              .join(' ')}
          >
            Everyone
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
            aria-label="Service filter"
            value={serviceId ?? 'all'}
            onChange={(e) =>
              router.replace(href({ svc: e.target.value === 'all' ? null : e.target.value }), {
                scroll: false,
              })
            }
          >
            <option value="all">All services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            aria-label="Status filter"
            value={statusKey}
            onChange={(e) =>
              router.replace(
                href({ status: e.target.value === 'active' ? null : e.target.value }),
                { scroll: false },
              )
            }
          >
            <option value="active">Hide cancelled</option>
            <option value="all">All statuses</option>
            <option value="pending">Pending only</option>
            <option value="confirmed">Confirmed only</option>
            <option value="completed">Completed only</option>
            <option value="noshow">No-shows only</option>
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
                Available
              </span>
              <span>
                <span
                  className={styles.sw}
                  style={{ background: '#fbe6d8', borderLeft: '3px solid #e0773a' }}
                />
                Booked
              </span>
              <span>
                <span className={[styles.sw, styles.brk].join(' ')} />
                Break
              </span>
              <span>
                <span className={[styles.sw, styles.blk].join(' ')} />
                Blocked
              </span>
              <span>
                <span className={[styles.sw, styles.off].join(' ')} />
                Not working
              </span>
              {shell.data.booking ? (
                <span className={styles.hint}>Click an open time to book it.</span>
              ) : null}
            </div>
            <div className={styles.gridWrap}>
              <div style={{ minWidth: minW }}>
                <div className={styles.head} style={{ gridTemplateColumns: cols }}>
                  <span />
                  {days.map((d) => (
                    <div key={d.date} className={styles.dayHead}>
                      <span style={{ color: d.isToday ? '#c4581f' : undefined }}>
                        {labelDate(d.date)}
                        {d.isToday ? ' · Today' : ''}
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
                          {((h + 11) % 12) + 1}
                          {h < 12 ? 'a' : 'p'}
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
                                title={`${it.customer} · ${it.service} · ${fmtMin(it.startMin)}–${fmtMin(it.endMin)} · ${staff.find((s) => s.id === lane.staffId)?.name} · ${APPOINTMENT_STATUS_LABEL[it.status]}`}
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
                                <span>{fmtMin(it.startMin)}</span>
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
                      <span>
                        {items.length ? `${items.length} appt${items.length === 1 ? '' : 's'}` : ''}
                      </span>
                    </span>
                    {items.slice(0, 3).map((i) => (
                      <span
                        key={i.id}
                        className={styles.chip}
                        style={{ background: STATUS_BG[i.status], color: '#1c1a17' }}
                      >
                        {fmtMin(i.startMin)
                          .replace(':00', '')
                          .replace(' AM', 'a')
                          .replace(' PM', 'p')}{' '}
                        {i.customer}
                      </span>
                    ))}
                    {items.length > 3 ? (
                      <span className={styles.more}>+{items.length - 3} more</span>
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
