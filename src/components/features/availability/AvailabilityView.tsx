'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, FormMessage, Select } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';
import {
  daySlots,
  type BusyInput,
  type ExceptionInput,
  type ServiceInput,
} from '@/modules/scheduling/availability';
import { type Interval, intersect, validateDayPeriods } from '@/modules/scheduling/intervals';
import {
  addExceptionAction,
  removeExceptionAction,
  saveAvailabilityAction,
} from '@/modules/scheduling/actions';
import {
  addDaysIso,
  fmtMin,
  labelDate,
  quarterOptions,
} from '@/components/features/appointments/time-options';
import { useNow } from '@/lib/hooks';
import styles from './Availability.module.scss';

type Week = Record<string, Interval[]>; // ISO weekday '1'..'7'
const DAY_LABELS: [string, string][] = [
  ['1', 'Mon'],
  ['2', 'Tue'],
  ['3', 'Wed'],
  ['4', 'Thu'],
  ['5', 'Fri'],
  ['6', 'Sat'],
  ['7', 'Sun'],
];
const TIME_OPTS = quarterOptions(6 * 60, 22 * 60 + 30, 30);
const ZONES = [
  ['America/New_York', 'Eastern (New York)'],
  ['America/Chicago', 'Central (Chicago)'],
  ['America/Denver', 'Mountain (Denver)'],
  ['America/Los_Angeles', 'Pacific (Los Angeles)'],
  ['Europe/London', 'London'],
];

interface ExceptionView extends ExceptionInput {
  id: string;
}

function emptyWeek(): Week {
  return Object.fromEntries(DAY_LABELS.map(([d]) => [d, []]));
}

function toWeek(
  rules: { staffId: string | null; dayOfWeek: number; startMin: number; endMin: number }[],
  staffId: string | null,
): Week {
  const w = emptyWeek();
  for (const r of rules
    .filter((x) => x.staffId === staffId)
    .sort((a, b) => a.startMin - b.startMin)) {
    w[String(r.dayOfWeek)]!.push({ start: r.startMin, end: r.endMin });
  }
  return w;
}

export function AvailabilityView({
  today,
  timezone,
  staff,
  rules,
  exceptions,
  policy,
  previewService,
  busy,
}: {
  today: string;
  timezone: string;
  staff: { id: string; name: string }[];
  rules: { staffId: string | null; dayOfWeek: number; startMin: number; endMin: number }[];
  exceptions: ExceptionView[];
  policy: { slotIntervalMin: number; minNoticeMin: number; maxAdvanceDays: number };
  previewService: (ServiceInput & { name: string }) | null;
  busy: BusyInput[];
}) {
  const { data } = useShell();
  const slug = data.tenant.slug;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const initial = useMemo(
    () => ({
      business: toWeek(rules, null),
      staff: Object.fromEntries(
        staff.map((s) => [
          s.id,
          rules.some((r) => r.staffId === s.id) ? toWeek(rules, s.id) : null,
        ]),
      ) as Record<string, Week | null>,
      rules: { ...policy, timezone },
    }),
    [rules, staff, policy, timezone],
  );
  const [state, setState] = useState(initial);
  const [target, setTarget] = useState<'business' | string>('business');
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  const week: Week =
    target === 'business' ? state.business : (state.staff[target] ?? state.business);
  const inherits = target !== 'business' && state.staff[target] === null;

  function setWeek(next: Week) {
    if (target === 'business') setState({ ...state, business: next });
    else setState({ ...state, staff: { ...state.staff, [target]: next } });
  }

  const dayErrors = Object.fromEntries(
    DAY_LABELS.map(([d]) => {
      const err = validateDayPeriods(week[d]!);
      return [
        d,
        err === 'overlap'
          ? 'Periods overlap.'
          : err === 'end_before_start'
            ? 'End time must be after start time.'
            : null,
      ];
    }),
  );
  const invalid = [
    state.business,
    ...Object.values(state.staff).filter((w): w is Week => w !== null),
  ].some((w) => Object.values(w).some((p) => validateDayPeriods(p) !== null));

  // ── Preview (uses unsaved changes) ──────────────────────────────────────────
  const [prevStaff, setPrevStaff] = useState(staff[0]?.id ?? '');
  const [prevDate, setPrevDate] = useState(today);
  const nowMs = useNow();
  const preview = useMemo(() => {
    if (!previewService || !prevStaff) return null;
    const ruleRows = [
      ...Object.entries(state.business).flatMap(([d, ps]) =>
        ps.map((p) => ({ staffId: null, dayOfWeek: Number(d), startMin: p.start, endMin: p.end })),
      ),
      ...Object.entries(state.staff).flatMap(([sid, w]) =>
        w
          ? Object.entries(w).flatMap(([d, ps]) =>
              ps.map((p) => ({
                staffId: sid,
                dayOfWeek: Number(d),
                startMin: p.start,
                endMin: p.end,
              })),
            )
          : [],
      ),
    ];
    try {
      return daySlots(
        { tz: state.rules.timezone, rules: ruleRows, exceptions, busy },
        {
          date: prevDate,
          staffIds: [prevStaff],
          service: previewService,
          policy: {
            slotIntervalMin: state.rules.slotIntervalMin,
            minNoticeMin: state.rules.minNoticeMin,
            maxAdvanceDays: state.rules.maxAdvanceDays,
          },
          nowMs,
          mode: 'public',
        },
      );
    } catch {
      return null;
    }
  }, [state, prevStaff, prevDate, previewService, exceptions, busy, nowMs]);

  function save() {
    setSaveError(null);
    startTransition(async () => {
      const res = await saveAvailabilityAction(slug, {
        business: state.business,
        staff: state.staff,
        rules: state.rules,
      });
      if (!res.ok) return setSaveError(res.error.message);
      toast('Availability saved · calendar updated');
      router.refresh();
    });
  }

  // ── Overrides / time off ───────────────────────────────────────────────────
  const [ov, setOv] = useState({
    scope: 'business',
    date: addDaysIso(today, 1),
    type: 'CLOSED' as 'CLOSED' | 'CUSTOM_HOURS' | 'BLOCK',
    a: 540,
    b: 840,
    note: '',
  });
  const [ovError, setOvError] = useState<string | null>(null);
  function addOverride() {
    setOvError(null);
    startTransition(async () => {
      const res = await addExceptionAction(slug, {
        staffId: ov.scope === 'business' ? null : ov.scope,
        type: ov.type,
        date: ov.date,
        startMin: ov.type === 'CLOSED' ? undefined : ov.a,
        endMin: ov.type === 'CLOSED' ? undefined : ov.b,
        reason: ov.note || undefined,
      });
      if (!res.ok)
        return setOvError(
          res.error.fieldErrors ? Object.values(res.error.fieldErrors)[0]! : res.error.message,
        );
      setOv({ ...ov, note: '' });
      toast('Override added');
      router.refresh();
    });
  }
  function removeOverride(id: string) {
    startTransition(async () => {
      const res = await removeExceptionAction(slug, id);
      if (!res.ok) return setOvError(res.error.message);
      toast('Override removed');
      router.refresh();
    });
  }

  const staffName = (id: string | null) =>
    id ? (staff.find((s) => s.id === id)?.name ?? 'Staff') : 'Whole business';

  return (
    <>
      <PageHeader
        title="Availability & working hours"
        sub={`${data.tenant.name} · ${timezone.split('/').pop()?.replace(/_/g, ' ')} time`}
      />
      <PageContent>
        <div className={styles.explain}>
          <div className={styles.explainCard}>
            <span>1 · BUSINESS HOURS</span>
            <span>When the business is open</span>
            <span>The outer limit. Nobody can be booked outside these.</span>
          </div>
          <div className={styles.explainCard}>
            <span>2 · STAFF AVAILABILITY</span>
            <span>When each person works</span>
            <span>Inside business hours, with their own days, shifts and breaks.</span>
          </div>
          <div className={[styles.explainCard, styles.explainDark].join(' ')}>
            <span>3 · BOOKABLE SLOTS</span>
            <span>What customers see</span>
            <span>Staff time minus existing appointments, buffers and the notice rules below.</span>
          </div>
        </div>

        <div className={styles.cols}>
          <Card
            title="Weekly schedule"
            action={
              <select
                className={styles.sel}
                style={{ fontWeight: 600, padding: '7px 8px' }}
                aria-label="Schedule for"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="business">Business hours</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            }
          >
            {inherits ? (
              <FormMessage kind="warning">
                {staffName(target)} follows business hours. Edit below to give them their own days
                and shifts.
              </FormMessage>
            ) : null}
            <div>
              {DAY_LABELS.map(([d, label]) => {
                const periods = week[d]!;
                const open = periods.length > 0;
                const outside =
                  target !== 'business' &&
                  open &&
                  intersect(periods, state.business[d]!).reduce((s, p) => s + p.end - p.start, 0) <
                    periods.reduce((s, p) => s + p.end - p.start, 0);
                return (
                  <div key={d} className={styles.dayRow}>
                    <span className={styles.dayLabel}>{label}</span>
                    <button
                      type="button"
                      aria-pressed={open}
                      className={[styles.toggle, open && styles.toggleOn].filter(Boolean).join(' ')}
                      onClick={() =>
                        setWeek({
                          ...week,
                          [d]: open
                            ? []
                            : [
                                { start: 540, end: 780 },
                                { start: 810, end: 1080 },
                              ],
                        })
                      }
                    >
                      {open ? 'Open' : 'Closed'}
                    </button>
                    <div className={styles.periods}>
                      {periods.map((p, i) => (
                        <div key={i} className={styles.period}>
                          <select
                            className={styles.sel}
                            aria-label={`${label} start`}
                            value={p.start}
                            onChange={(e) =>
                              setWeek({
                                ...week,
                                [d]: periods.map((x, j) =>
                                  j === i ? { ...x, start: Number(e.target.value) } : x,
                                ),
                              })
                            }
                          >
                            {TIME_OPTS.map((o) => (
                              <option key={o.v} value={o.v}>
                                {o.l}
                              </option>
                            ))}
                          </select>
                          <span style={{ color: '#857d70' }}>–</span>
                          <select
                            className={styles.sel}
                            aria-label={`${label} end`}
                            value={p.end}
                            onChange={(e) =>
                              setWeek({
                                ...week,
                                [d]: periods.map((x, j) =>
                                  j === i ? { ...x, end: Number(e.target.value) } : x,
                                ),
                              })
                            }
                          >
                            {TIME_OPTS.map((o) => (
                              <option key={o.v} value={o.v}>
                                {o.l}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={styles.x}
                            aria-label="Remove period"
                            onClick={() =>
                              setWeek({ ...week, [d]: periods.filter((_, j) => j !== i) })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {open ? (
                        <button
                          type="button"
                          className={styles.add}
                          onClick={() => {
                            const last = periods[periods.length - 1]!;
                            const start = Math.min(last.end + 30, 1320);
                            setWeek({
                              ...week,
                              [d]: [...periods, { start, end: Math.min(start + 120, 1350) }],
                            });
                          }}
                        >
                          + Add period
                        </button>
                      ) : null}
                      {dayErrors[d] ? (
                        <span role="alert" className={styles.err}>
                          {dayErrors[d]}
                        </span>
                      ) : outside ? (
                        <span className={styles.warn}>
                          Outside business hours. Customers won&rsquo;t see the extra time.
                        </span>
                      ) : null}
                      <div className={styles.timeline} aria-hidden="true">
                        {periods.map((p, i) => (
                          <span
                            key={i}
                            style={{
                              left: `${((p.start - 360) / 960) * 100}%`,
                              width: `${((p.end - p.start) / 960) * 100}%`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <span className={styles.hint}>
              {target === 'business'
                ? 'Business hours limit everyone.'
                : `${staffName(target)}'s hours, inside business hours.`}{' '}
              Gaps between periods become breaks.
              {target !== 'business' && !inherits ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className={styles.add}
                    onClick={() =>
                      setState({ ...state, staff: { ...state.staff, [target]: null } })
                    }
                  >
                    Follow business hours instead
                  </button>
                </>
              ) : null}
            </span>
          </Card>

          <div className={styles.side}>
            <Card title="Booking rules">
              <div className={styles.rulesGrid}>
                <Field label="Slot interval">
                  {(p) => (
                    <Select
                      {...p}
                      value={state.rules.slotIntervalMin}
                      onChange={(e) =>
                        setState({
                          ...state,
                          rules: { ...state.rules, slotIntervalMin: Number(e.target.value) },
                        })
                      }
                    >
                      <option value={15}>Every 15 min</option>
                      <option value={30}>Every 30 min</option>
                      <option value={60}>Every hour</option>
                    </Select>
                  )}
                </Field>
                <Field label="Minimum notice">
                  {(p) => (
                    <Select
                      {...p}
                      value={state.rules.minNoticeMin}
                      onChange={(e) =>
                        setState({
                          ...state,
                          rules: { ...state.rules, minNoticeMin: Number(e.target.value) },
                        })
                      }
                    >
                      <option value={0}>None</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                      <option value={240}>4 hours</option>
                      <option value={1440}>1 day</option>
                    </Select>
                  )}
                </Field>
                <Field label="Book up to">
                  {(p) => (
                    <Select
                      {...p}
                      value={state.rules.maxAdvanceDays}
                      onChange={(e) =>
                        setState({
                          ...state,
                          rules: { ...state.rules, maxAdvanceDays: Number(e.target.value) },
                        })
                      }
                    >
                      <option value={14}>2 weeks ahead</option>
                      <option value={30}>30 days ahead</option>
                      <option value={60}>60 days ahead</option>
                      <option value={90}>90 days ahead</option>
                    </Select>
                  )}
                </Field>
                <Field label="Time zone">
                  {(p) => (
                    <Select
                      {...p}
                      value={state.rules.timezone}
                      onChange={(e) =>
                        setState({ ...state, rules: { ...state.rules, timezone: e.target.value } })
                      }
                    >
                      {ZONES.some(([z]) => z === timezone) ? null : (
                        <option value={timezone}>{timezone.replace(/_/g, ' ')}</option>
                      )}
                      {ZONES.map(([z, l]) => (
                        <option key={z} value={z}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            </Card>

            <Card
              title="What customers will see"
              action={
                <select
                  className={styles.sel}
                  aria-label="Preview staff"
                  value={prevStaff}
                  onChange={(e) => setPrevStaff(e.target.value)}
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              }
            >
              <div className={styles.dayPills}>
                {Array.from({ length: 7 }, (_, i) => addDaysIso(today, i)).map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={prevDate === d}
                    className={[styles.dayPill, prevDate === d && styles.dayPillOn]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setPrevDate(d)}
                  >
                    {i === 0 ? 'Today' : labelDate(d, { weekday: 'short', day: 'numeric' })}
                  </button>
                ))}
              </div>
              {previewService ? (
                <span style={{ fontSize: 12, color: '#6b6358' }}>
                  {previewService.name} ({previewService.durationMin} min
                  {previewService.bufferAfterMin
                    ? ` + ${previewService.bufferAfterMin} min buffer`
                    : ''}
                  ), using your unsaved changes.
                </span>
              ) : (
                <span style={{ fontSize: 13, color: '#5d564b' }}>
                  Add a service to preview bookable times.
                </span>
              )}
              {preview && !preview.closed ? (
                <div className={styles.slots}>
                  {preview.slots.map((s) => {
                    const cls = s.available
                      ? styles.ok
                      : s.reason === 'too_soon' || s.reason === 'past'
                        ? styles.soon
                        : s.reason === 'break' || s.reason === 'outside_hours'
                          ? styles.brk
                          : styles.taken;
                    const why = s.available
                      ? 'Bookable'
                      : s.reason === 'too_soon' || s.reason === 'past'
                        ? 'Inside minimum notice'
                        : s.reason === 'booked'
                          ? 'Booked'
                          : s.reason === 'blocked'
                            ? 'Blocked'
                            : 'Break or end of shift';
                    return (
                      <span key={s.startMin} title={why} className={[styles.slot, cls].join(' ')}>
                        {fmtMin(s.startMin)}
                      </span>
                    );
                  })}
                </div>
              ) : previewService ? (
                <span style={{ fontSize: 13, color: '#5d564b' }}>
                  Not working this day, so nothing is bookable.
                </span>
              ) : null}
              <div className={styles.legend}>
                <span>
                  <i className={styles.ok} /> Bookable
                </span>
                <span>
                  <i className={styles.taken} /> Booked
                </span>
                <span>
                  <i className={styles.brk} /> Break
                </span>
                <span>
                  <i className={styles.soon} /> Too soon
                </span>
              </div>
            </Card>

            <Card title="Holidays, overrides and time off">
              {exceptions.length === 0 ? (
                <span style={{ fontSize: 13, color: '#6b6358' }}>No upcoming overrides.</span>
              ) : null}
              {exceptions.map((o) => (
                <div key={o.id} className={styles.ovRow}>
                  <span style={{ fontWeight: 700 }}>
                    {labelDate(o.date)}
                    {o.endDate && o.endDate !== o.date ? ` – ${labelDate(o.endDate)}` : ''}
                  </span>
                  <span>
                    <span style={{ fontWeight: 600 }}>
                      {o.type === 'CLOSED'
                        ? o.staffId
                          ? 'Day off'
                          : 'Closed'
                        : o.type === 'CUSTOM_HOURS'
                          ? `${fmtMin(o.startMin!)}–${fmtMin(o.endMin!)}`
                          : `Blocked ${fmtMin(o.startMin!)}–${fmtMin(o.endMin!)}`}
                    </span>{' '}
                    <span style={{ color: '#6b6358' }}>
                      {staffName(o.staffId)}
                      {o.reason ? ` · ${o.reason}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={styles.remove}
                    disabled={pending}
                    onClick={() => removeOverride(o.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className={styles.ovAdd}>
                <select
                  aria-label="Applies to"
                  value={ov.scope}
                  onChange={(e) =>
                    setOv({
                      ...ov,
                      scope: e.target.value,
                      type:
                        e.target.value === 'business' && ov.type === 'BLOCK' ? 'CLOSED' : ov.type,
                    })
                  }
                >
                  <option value="business">Whole business</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  aria-label="Override date"
                  value={ov.date}
                  min={today}
                  onChange={(e) => setOv({ ...ov, date: e.target.value })}
                />
                <select
                  aria-label="Override type"
                  value={ov.type}
                  onChange={(e) => setOv({ ...ov, type: e.target.value as typeof ov.type })}
                >
                  <option value="CLOSED">
                    {ov.scope === 'business' ? 'Closed all day' : 'Day off'}
                  </option>
                  <option value="CUSTOM_HOURS">Custom hours</option>
                  <option value="BLOCK">Block time</option>
                </select>
                {ov.type !== 'CLOSED' ? (
                  <>
                    <select
                      aria-label="From"
                      value={ov.a}
                      onChange={(e) => setOv({ ...ov, a: Number(e.target.value) })}
                    >
                      {TIME_OPTS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.l}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="To"
                      value={ov.b}
                      onChange={(e) => setOv({ ...ov, b: Number(e.target.value) })}
                    >
                      {TIME_OPTS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.l}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                <input
                  style={{ flex: '1 1 140px' }}
                  value={ov.note}
                  maxLength={120}
                  onChange={(e) => setOv({ ...ov, note: e.target.value })}
                  placeholder="Note, e.g. Staff training"
                />
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={addOverride}
                  style={{ borderColor: '#1c1a17' }}
                >
                  Add
                </Button>
              </div>
              {ovError ? <span className={styles.err}>{ovError}</span> : null}
            </Card>
          </div>
        </div>

        {saveError ? <FormMessage kind="error">{saveError}</FormMessage> : null}
        {dirty ? (
          <div className={styles.saveBar}>
            <span style={{ fontWeight: 600 }}>Unsaved availability changes</span>
            <button
              type="button"
              className={styles.discard}
              onClick={() => {
                setState(initial);
                toast('Changes discarded');
              }}
            >
              Discard
            </button>
            <Button variant="accent" disabled={invalid || pending} onClick={save}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        ) : null}
      </PageContent>
    </>
  );
}
