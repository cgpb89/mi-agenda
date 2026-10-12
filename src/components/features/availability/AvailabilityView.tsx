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
import { useI18n } from '@/i18n/client';
import { weekdayNames } from '@/components/features/shared/format';

type Week = Record<string, Interval[]>; // ISO weekday '1'..'7'
const DAYS = ['1', '2', '3', '4', '5', '6', '7'];
const ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
] as const;

interface ExceptionView extends ExceptionInput {
  id: string;
}

function emptyWeek(): Week {
  return Object.fromEntries(DAYS.map((d) => [d, []]));
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
  const { t, locale } = useI18n();
  const av = t.availability;
  const shortDays = weekdayNames(locale, 'short');
  const DAY_LABELS: [string, string][] = DAYS.map((d, i) => [d, shortDays[i]!]);
  const TIME_OPTS = useMemo(() => quarterOptions(locale, 6 * 60, 22 * 60 + 30, 30), [locale]);
  const fmt = (m: number) => fmtMin(m, locale);

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
          ? av.periodsOverlap
          : err === 'end_before_start'
            ? av.endAfterStart
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
      toast(av.toastSaved);
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
      toast(av.toastOverrideAdded);
      router.refresh();
    });
  }
  function removeOverride(id: string) {
    startTransition(async () => {
      const res = await removeExceptionAction(slug, id);
      if (!res.ok) return setOvError(res.error.message);
      toast(av.toastOverrideRemoved);
      router.refresh();
    });
  }

  const staffName = (id: string | null) =>
    id ? (staff.find((s) => s.id === id)?.name ?? av.staffFallback) : av.wholeBusiness;

  return (
    <>
      <PageHeader
        title={t.app.titles.availability}
        sub={av.sub({
          business: data.tenant.name,
          zone: timezone.split('/').pop()?.replace(/_/g, ' ') ?? timezone,
        })}
      />
      <PageContent>
        <div className={styles.explain}>
          {av.explain.map(([eyebrow, title, body], i) => (
            <div
              key={eyebrow}
              className={[styles.explainCard, i === 2 && styles.explainDark]
                .filter(Boolean)
                .join(' ')}
            >
              <span>{eyebrow}</span>
              <span>{title}</span>
              <span>{body}</span>
            </div>
          ))}
        </div>

        <div className={styles.cols}>
          <Card
            title={av.weekly}
            action={
              <select
                className={styles.sel}
                style={{ fontWeight: 600, padding: '7px 8px' }}
                aria-label={av.scheduleFor}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="business">{av.businessHours}</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            }
          >
            {inherits ? (
              <FormMessage kind="warning">{av.inherits({ name: staffName(target) })}</FormMessage>
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
                      {open ? av.open : av.closed}
                    </button>
                    <div className={styles.periods}>
                      {periods.map((p, i) => (
                        <div key={i} className={styles.period}>
                          <select
                            className={styles.sel}
                            aria-label={av.start({ day: label })}
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
                            aria-label={av.end({ day: label })}
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
                            aria-label={av.removePeriod}
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
                          {av.addPeriod}
                        </button>
                      ) : null}
                      {dayErrors[d] ? (
                        <span role="alert" className={styles.err}>
                          {dayErrors[d]}
                        </span>
                      ) : outside ? (
                        <span className={styles.warn}>{av.outside}</span>
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
                ? av.limitEveryone
                : av.staffHours({ name: staffName(target) })}{' '}
              {av.gaps}
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
                    {av.followBusiness}
                  </button>
                </>
              ) : null}
            </span>
          </Card>

          <div className={styles.side}>
            <Card title={av.rules} tourId="availability-hours">
              <div className={styles.rulesGrid}>
                <Field label={av.slotInterval}>
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
                      <option value={15}>{av.every({ n: 15 })}</option>
                      <option value={30}>{av.every({ n: 30 })}</option>
                      <option value={60}>{av.everyHour}</option>
                    </Select>
                  )}
                </Field>
                <Field label={av.minNotice}>
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
                      <option value={0}>{av.none}</option>
                      <option value={60}>{av.hours({ n: 1 })}</option>
                      <option value={120}>{av.hours({ n: 2 })}</option>
                      <option value={240}>{av.hours({ n: 4 })}</option>
                      <option value={1440}>{av.oneDay}</option>
                    </Select>
                  )}
                </Field>
                <Field label={av.bookUpTo}>
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
                      <option value={14}>{av.twoWeeks}</option>
                      <option value={30}>{av.daysAhead({ n: 30 })}</option>
                      <option value={60}>{av.daysAhead({ n: 60 })}</option>
                      <option value={90}>{av.daysAhead({ n: 90 })}</option>
                    </Select>
                  )}
                </Field>
                <Field label={av.timezone}>
                  {(p) => (
                    <Select
                      {...p}
                      value={state.rules.timezone}
                      onChange={(e) =>
                        setState({ ...state, rules: { ...state.rules, timezone: e.target.value } })
                      }
                    >
                      {(ZONES as readonly string[]).includes(timezone) ? null : (
                        <option value={timezone}>{timezone.replace(/_/g, ' ')}</option>
                      )}
                      {ZONES.map((z) => (
                        <option key={z} value={z}>
                          {av.zones[z]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            </Card>

            <Card
              title={av.preview}
              action={
                <select
                  className={styles.sel}
                  aria-label={av.previewStaff}
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
                    {i === 0
                      ? av.today
                      : labelDate(d, locale, { weekday: 'short', day: 'numeric' })}
                  </button>
                ))}
              </div>
              {previewService ? (
                <span style={{ fontSize: 12, color: '#6b6358' }}>
                  {av.previewNote({
                    service: previewService.name,
                    duration: previewService.durationMin,
                    buffer: previewService.bufferAfterMin,
                  })}
                </span>
              ) : (
                <span style={{ fontSize: 13, color: '#5d564b' }}>{av.addService}</span>
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
                      ? av.bookable
                      : s.reason === 'too_soon' || s.reason === 'past'
                        ? av.insideNotice
                        : s.reason === 'booked'
                          ? av.booked
                          : s.reason === 'blocked'
                            ? av.blocked
                            : av.breakOrEnd;
                    return (
                      <span key={s.startMin} title={why} className={[styles.slot, cls].join(' ')}>
                        {fmt(s.startMin)}
                      </span>
                    );
                  })}
                </div>
              ) : previewService ? (
                <span style={{ fontSize: 13, color: '#5d564b' }}>{av.notWorking}</span>
              ) : null}
              <div className={styles.legend}>
                <span>
                  <i className={styles.ok} /> {av.bookable}
                </span>
                <span>
                  <i className={styles.taken} /> {av.booked}
                </span>
                <span>
                  <i className={styles.brk} /> {av.break}
                </span>
                <span>
                  <i className={styles.soon} /> {av.tooSoon}
                </span>
              </div>
            </Card>

            <Card title={av.overrides}>
              {exceptions.length === 0 ? (
                <span style={{ fontSize: 13, color: '#6b6358' }}>{av.noOverrides}</span>
              ) : null}
              {exceptions.map((o) => (
                <div key={o.id} className={styles.ovRow}>
                  <span style={{ fontWeight: 700 }}>
                    {labelDate(o.date, locale)}
                    {o.endDate && o.endDate !== o.date ? ` – ${labelDate(o.endDate, locale)}` : ''}
                  </span>
                  <span>
                    <span style={{ fontWeight: 600 }}>
                      {o.type === 'CLOSED'
                        ? o.staffId
                          ? av.dayOff
                          : av.closed
                        : o.type === 'CUSTOM_HOURS'
                          ? `${fmt(o.startMin!)}–${fmt(o.endMin!)}`
                          : av.blockedRange({ range: `${fmt(o.startMin!)}–${fmt(o.endMin!)}` })}
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
                    {av.remove}
                  </button>
                </div>
              ))}
              <div className={styles.ovAdd}>
                <select
                  aria-label={av.appliesTo}
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
                  <option value="business">{av.wholeBusiness}</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  aria-label={av.overrideDate}
                  value={ov.date}
                  min={today}
                  onChange={(e) => setOv({ ...ov, date: e.target.value })}
                />
                <select
                  aria-label={av.overrideType}
                  value={ov.type}
                  onChange={(e) => setOv({ ...ov, type: e.target.value as typeof ov.type })}
                >
                  <option value="CLOSED">
                    {ov.scope === 'business' ? av.closedAllDay : av.dayOff}
                  </option>
                  <option value="CUSTOM_HOURS">{av.customHours}</option>
                  <option value="BLOCK">{av.blockTime}</option>
                </select>
                {ov.type !== 'CLOSED' ? (
                  <>
                    <select
                      aria-label={av.from}
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
                      aria-label={av.to}
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
                  placeholder={av.notePlaceholder}
                />
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={addOverride}
                  style={{ borderColor: '#1c1a17' }}
                >
                  {av.add}
                </Button>
              </div>
              {ovError ? <span className={styles.err}>{ovError}</span> : null}
            </Card>
          </div>
        </div>

        {saveError ? <FormMessage kind="error">{saveError}</FormMessage> : null}
        {dirty ? (
          <div className={styles.saveBar}>
            <span style={{ fontWeight: 600 }}>{av.unsaved}</span>
            <button
              type="button"
              className={styles.discard}
              onClick={() => {
                setState(initial);
                toast(av.toastDiscarded);
              }}
            >
              {av.discard}
            </button>
            <Button loading={pending} variant="accent" disabled={invalid || pending} onClick={save}>
              {pending ? av.saving : av.save}
            </Button>
          </div>
        ) : null}
      </PageContent>
    </>
  );
}
