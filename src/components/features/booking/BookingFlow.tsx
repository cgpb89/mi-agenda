'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PHONE_COUNTRIES } from '@/lib/phone/countries';
import { COPY, THEMES, type TemplateKey } from './themes';
import { demoAvailability, type DemoBusiness } from '@/components/features/landing/demo-data';
import styles from './BookingFlow.module.scss';

export interface FlowService {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceMinor: number;
  staffIds: string[];
}

export interface FlowStaff {
  id: string;
  name: string;
  title: string | null;
}

export interface ExistingBooking {
  token: string;
  confirmationCode: string;
  status: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  startAt: string;
  endAt: string;
  durationMin: number;
  priceMinor: number;
  contactName: string;
  contactEmail: string | null;
  canModify: boolean;
  cancellationWindowMin: number;
}

interface Props {
  slug: string;
  template: TemplateKey;
  businessName: string;
  timezone: string;
  currency: string;
  country: string;
  address: string | null;
  policyText: string | null;
  requireEmail: boolean;
  minNoticeMin: number;
  cancellationWindowMin: number;
  services: FlowService[];
  staff: FlowStaff[];
  /** Manage-link mode: start on the confirmation of an existing booking. */
  existing?: ExistingBooking;
  /** Owner preview of an unpublished page: no submissions. */
  preview?: boolean;
  /** Marketing demo: local fake availability, nothing is sent to the server. */
  demo?: DemoBusiness;
}

interface Done {
  confirmationCode: string;
  status: string;
  startAt: string;
  endAt: string;
  staffName: string;
  serviceName: string;
  durationMin: number;
  priceMinor: number;
  managePath: string | null;
  emailed: boolean;
}

interface Availability {
  today: string;
  date: string;
  days: { date: string; status: 'open' | 'full' | 'closed' }[];
  slots: { startMin: number; available: boolean }[] | null;
}

const STEP_NAMES = (staffLabel: string) => ['Service', staffLabel, 'Time', 'Details', 'Review'];

function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function money(minor: number, currency: string) {
  if (minor === 0) return 'Free';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: minor % 100 ? 2 : 0,
  }).format(minor / 100);
}

function dateLabel(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

function tzLabel(tz: string) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

function initials(name: string) {
  return name
    .replace(/^Dr\.\s+/, '')
    .split(/\s+/)
    .map((x) => x[0])
    .join('')
    .slice(0, 2);
}

function inZone(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString('en-US', { ...opts, timeZone: tz });
}

function localDate(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });
}

function icsStamp(iso: string) {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function icsEscape(s: string) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
        Math.floor(Math.random() * 16).toString(16),
      );
}

export function BookingFlow(props: Props) {
  const t = THEMES[props.template];
  const copy = COPY[props.template];
  const tz = props.timezone;
  const names = STEP_NAMES(copy.staffLabel);

  const [step, setStep] = useState(props.existing ? 5 : 0);
  const [svcId, setSvcId] = useState<string | null>(props.existing?.serviceId ?? null);
  const [staffSel, setStaffSel] = useState<string | null>(props.existing?.staffId ?? null); // 'any' | id
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    country: props.country,
    notes: '',
    website: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [avail, setAvail] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<Done | null>(
    props.existing
      ? {
          confirmationCode: props.existing.confirmationCode,
          status: props.existing.status,
          startAt: props.existing.startAt,
          endAt: props.existing.endAt,
          staffName: props.existing.staffName,
          serviceName: props.existing.serviceName,
          durationMin: props.existing.durationMin,
          priceMinor: props.existing.priceMinor,
          managePath: null,
          emailed: false,
        }
      : null,
  );
  const [cancelled, setCancelled] = useState(props.existing?.status === 'CANCELLED');
  const [askCancel, setAskCancel] = useState(false);
  const [resched, setResched] = useState(false);
  const idemKey = useRef<string | null>(null);
  const detailsShownAt = useRef<number | null>(null);

  const svc = props.services.find((s) => s.id === svcId) ?? null;
  const dur = svc?.durationMin ?? props.existing?.durationMin ?? 30;
  const canModify = props.existing ? props.existing.canModify && !cancelled : !cancelled;

  /** Load days + slots. Called from event handlers with explicit selections. */
  async function fetchAvailability(
    serviceId: string | null,
    staff: string | null,
    d: string | null,
  ) {
    if (!serviceId || !staff) return;
    if (props.demo) {
      const data = demoAvailability(
        props.demo,
        props.services.find((x) => x.id === serviceId)?.durationMin ?? 30,
        staff,
        d,
      );
      setAvail(data);
      setDate(data.date);
      return;
    }
    setLoading(true);
    setAvail(null);
    try {
      const get = async (day: string | null) => {
        const qs = new URLSearchParams({ serviceId, staff, ...(day ? { date: day } : {}) });
        const res = await fetch(`/api/public/${props.slug}/availability?${qs}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error();
        return (await res.json()) as Availability;
      };
      let data = await get(d);
      if (!d) {
        const first = data.days.find((x) => x.status === 'open');
        if (first && first.date !== data.date) data = await get(first.date);
      }
      setAvail(data);
      setDate(data.date);
    } catch {
      setAvail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (step === 3 && detailsShownAt.current === null) detailsShownAt.current = Date.now();
  }, [step]);

  const pickDate = (d: string) => {
    setDate(d);
    setTime(null);
    void fetchAvailability(svcId, staffSel, d);
  };

  const slotGroups = useMemo(() => {
    const slots = avail?.slots ?? [];
    return (
      [
        ['Morning', 0, 720],
        ['Afternoon', 720, 1020],
        ['Evening', 1020, 1440],
      ] as const
    )
      .map(([label, a, z]) => ({
        label,
        slots: slots.filter((s) => s.startMin >= a && s.startMin < z),
      }))
      .filter((g) => g.slots.length);
  }, [avail]);

  const noSlots =
    step === 2 && avail !== null && !loading && !(avail.slots ?? []).some((s) => s.available);
  const nextOpen = avail?.days.find((d) => d.status === 'open' && date !== null && d.date > date);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Enter your name';
    if (props.requireEmail || form.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    }
    if (form.phone.replace(/\D/g, '').length < 6) e.phone = 'Enter a phone number we can reach';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function confirm() {
    if (props.demo) {
      setSubmitting(true);
      await new Promise((r) => setTimeout(r, 700));
      const [y, mo, dd] = (date ?? '2026-01-01').split('-').map(Number);
      const start = new Date(y!, mo! - 1, dd!, Math.floor((time ?? 0) / 60), (time ?? 0) % 60);
      setDone({
        confirmationCode: `TMP-${4000 + (((time ?? 0) * 7) % 5000)}-K`,
        status: 'CONFIRMED',
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + dur * 60_000).toISOString(),
        staffName: staffSel === 'any' ? (props.staff[0]?.name ?? '') : (staffName ?? ''),
        serviceName: svc?.name ?? '',
        durationMin: dur,
        priceMinor: svc?.priceMinor ?? 0,
        managePath: null,
        emailed: false,
      });
      setSubmitting(false);
      setStep(5);
      return;
    }
    if (props.preview) {
      setSubmitErr('This is a preview of an unpublished page. Publish it to take bookings.');
      return;
    }
    setSubmitting(true);
    setSubmitErr('');
    try {
      if (resched && props.existing) {
        const res = await fetch(`/api/public/${props.slug}/manage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reschedule',
            token: props.existing.token,
            date,
            startMin: time,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? 'Something went wrong.');
        setDone({ ...done!, startAt: data.startAt, endAt: data.endAt, status: data.status });
        setStep(5);
        return;
      }
      idemKey.current ??= newKey();
      const res = await fetch(`/api/public/${props.slug}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: svcId,
          staffId: staffSel === 'any' ? null : staffSel,
          date,
          startMin: time,
          name: form.name,
          email: form.email.trim() || undefined,
          phone: form.phone,
          phoneCountry: form.country,
          notes: form.notes.trim() || undefined,
          idempotencyKey: idemKey.current,
          website: form.website,
          startedAt: detailsShownAt.current ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const fe = data?.error?.fieldErrors ?? {};
        if (fe.slot === 'booked' || data?.error?.code === 'SLOT_TAKEN') {
          // Refresh times and send the customer back to pick another.
          setTime(null);
          setStep(2);
          idemKey.current = null;
          void fetchAvailability(svcId, staffSel, date);
        }
        if (fe.phone && fe.phone !== 'limit') setErrors({ phone: fe.phone });
        if (fe.email) setErrors({ email: fe.email });
        throw new Error(data?.error?.message ?? 'Something went wrong. Please try again.');
      }
      setDone(data as Done);
      setStep(5);
      if (data.managePath) {
        try {
          window.history.replaceState(null, '', data.managePath);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function doCancel() {
    if (!props.existing) {
      setAskCancel(false);
      return;
    }
    setSubmitting(true);
    setSubmitErr('');
    try {
      const res = await fetch(`/api/public/${props.slug}/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', token: props.existing.token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Something went wrong.');
      setCancelled(true);
      setAskCancel(false);
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  function addToCalendar() {
    if (!done) return;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tempo//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${done.confirmationCode}@tempo`,
      `DTSTAMP:${icsStamp(new Date().toISOString())}`,
      `DTSTART:${icsStamp(done.startAt)}`,
      `DTEND:${icsStamp(done.endAt)}`,
      `SUMMARY:${icsEscape(`${done.serviceName} at ${props.businessName}`)}`,
      ...(props.address ? [`LOCATION:${icsEscape(props.address)}`] : []),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = `tempo-${done.confirmationCode}.ics`;
    a.click();
  }

  // ── Derived display ─────────────────────────────────────────────────────────
  const staffName =
    staffSel === null
      ? null
      : staffSel === 'any'
        ? 'First available'
        : (props.staff.find((s) => s.id === staffSel)?.name ?? props.existing?.staffName ?? null);
  const timeStr = time === null ? '' : `${fmtMin(time)} – ${fmtMin(time + dur)}`;
  const stepCanContinue =
    [svcId !== null, staffSel !== null, time !== null, true, !submitting][step] ?? false;
  const isDone = step === 5;
  const title = isDone ? props.businessName : resched ? 'Pick a new time' : 'Book an appointment';
  const serviceLabelCap = copy.serviceLabel[0]!.toUpperCase() + copy.serviceLabel.slice(1);

  const summary =
    svc || props.existing
      ? [
          { k: serviceLabelCap, v: svc?.name ?? props.existing!.serviceName },
          { k: copy.staffLabel, v: staffSel === 'any' ? 'First available' : (staffName ?? '—') },
          {
            k: 'Date',
            v: date ? dateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' }) : '',
          },
          { k: 'Time', v: `${timeStr} · ${dur} min` },
          {
            k: 'Price',
            v: `${money(svc?.priceMinor ?? props.existing?.priceMinor ?? 0, props.currency)}${(svc?.priceMinor ?? 1) ? ' · pay at the visit' : ''}`,
          },
          ...(resched
            ? []
            : [
                {
                  k: 'Contact',
                  v: [form.name, form.email, form.phone].filter(Boolean).join(' · '),
                },
              ]),
          ...(props.address ? [{ k: 'Where', v: props.address }] : []),
          ...(form.notes && !resched ? [{ k: 'Notes', v: form.notes }] : []),
        ]
      : [];

  const doneSummary = done
    ? [
        { k: serviceLabelCap, v: done.serviceName },
        { k: copy.staffLabel, v: done.staffName },
        {
          k: 'Date',
          v: inZone(done.startAt, tz, { weekday: 'long', month: 'long', day: 'numeric' }),
        },
        {
          k: 'Time',
          v: `${inZone(done.startAt, tz, { hour: 'numeric', minute: '2-digit' })} – ${inZone(done.endAt, tz, { hour: 'numeric', minute: '2-digit' })} · ${done.durationMin} min`,
        },
        {
          k: 'Price',
          v: `${money(done.priceMinor, props.currency)}${done.priceMinor ? ' · pay at the visit' : ''}`,
        },
      ]
    : [];

  const footerSummary =
    [
      svc?.name,
      staffName,
      time !== null && date
        ? `${dateLabel(date, { weekday: 'short', month: 'short', day: 'numeric' })}, ${fmtMin(time)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'No selection yet';

  const vars = {
    '--bf-surface': t.surface,
    '--bf-ink': t.ink,
    '--bf-muted': t.muted,
    '--bf-line': t.line,
    '--bf-accent': t.accent,
    '--bf-accent-ink': t.accentInk,
    '--bf-font': t.font,
    '--bf-display': t.display,
    '--bf-title-size': t.titleSize,
    '--bf-title-weight': t.titleWeight,
    '--bf-title-style': t.titleStyle,
    '--bf-upper': t.upper,
    '--bf-title-track': t.titleTrack,
    '--bf-stretch': t.stretch,
    '--bf-radius': t.radius,
    '--bf-panel-radius': t.panelRadius,
    '--bf-slot-off': t.slotOff,
    '--bf-field': t.field,
    '--bf-error': t.error,
    '--bf-sel': t.sel,
  } as CSSProperties;

  const noticeLabel =
    props.minNoticeMin === 0
      ? ''
      : props.minNoticeMin >= 1440
        ? ` (${props.minNoticeMin / 1440} day minimum notice)`
        : ` (${props.minNoticeMin / 60} hour minimum notice)`;

  return (
    <section className={styles.root} style={vars} aria-label="Book an appointment">
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          <span className={styles.stepLabel}>
            {isDone ? (cancelled ? 'Cancelled' : 'Booked') : `Step ${step + 1} of 5`}
          </span>
        </div>
        {!isDone ? (
          <div className={styles.steps}>
            {names.map((label, i) => {
              const back = i < step && !(resched && i < 2);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={!back}
                  aria-current={i === step ? 'step' : undefined}
                  className={[
                    styles.step,
                    i <= step && styles.stepDone,
                    i === step && styles.stepCurrent,
                    back && styles.stepBack,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => back && setStep(i)}
                >
                  <span />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className={styles.body}>
        {step === 0 ? (
          <>
            <div className={styles.lead}>Choose a {copy.serviceLabel}</div>
            <div className={styles.list}>
              {props.services.length === 0 ? (
                <div className={styles.small}>Online booking isn&rsquo;t available right now.</div>
              ) : null}
              {props.services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={svcId === s.id}
                  className={[styles.option, svcId === s.id && styles.optionSel]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setSvcId(s.id);
                    setStaffSel(null);
                    setTime(null);
                    setAvail(null);
                    setStep(1);
                  }}
                >
                  <span>{s.name}</span>
                  <span>{money(s.priceMinor, props.currency)}</span>
                  <span>{s.description}</span>
                  <span>{s.durationMin} min</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 1 && svc ? (
          <>
            <div className={styles.lead}>Who would you like to see?</div>
            <div className={styles.people}>
              {[
                { id: 'any', name: 'No preference', title: 'First available' },
                ...props.staff.filter((p) => svc.staffIds.includes(p.id)),
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={staffSel === p.id}
                  className={[styles.person, staffSel === p.id && styles.personSel]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setStaffSel(p.id);
                    setTime(null);
                    setDate(null);
                    setStep(2);
                    void fetchAvailability(svc.id, p.id, null);
                  }}
                >
                  <span className={styles.avatar}>{p.id === 'any' ? '∗' : initials(p.name)}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                    <span className={styles.small}>{p.title}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className={styles.monthRow}>
              <span>{date ? dateLabel(date, { month: 'long', year: 'numeric' }) : ''}</span>
              <span>Times in {tzLabel(tz)}</span>
            </div>
            {avail ? (
              <div className={styles.days}>
                {avail.days.map((d, i) => {
                  const sel = date === d.date;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      disabled={d.status === 'closed'}
                      aria-pressed={sel}
                      className={[styles.day, sel && styles.daySel].filter(Boolean).join(' ')}
                      onClick={() => pickDate(d.date)}
                    >
                      <span>{dateLabel(d.date, { weekday: 'short' })}</span>
                      <span>{Number(d.date.slice(8))}</span>
                      <span>
                        {d.status === 'closed'
                          ? 'Closed'
                          : d.status === 'full'
                            ? 'Full'
                            : i === 0
                              ? 'Today'
                              : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {loading ? <div className={styles.loading}>Loading times…</div> : null}
            {!loading && avail === null && svcId && staffSel ? (
              <div className={styles.alert}>We couldn&rsquo;t load times. Please try again.</div>
            ) : null}
            {noSlots ? (
              <div className={styles.noSlots}>
                <div style={{ fontWeight: 600 }}>
                  No times left on{' '}
                  {date
                    ? dateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' })
                    : 'this day'}
                  .
                </div>
                {nextOpen ? (
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => pickDate(nextOpen.date)}
                  >
                    Show{' '}
                    {dateLabel(nextOpen.date, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </button>
                ) : (
                  <span className={styles.small}>
                    No openings in the next two weeks. Please contact the business.
                  </span>
                )}
              </div>
            ) : null}
            {!loading
              ? slotGroups.map((g) => (
                  <div key={g.label} className={styles.group}>
                    <div className={styles.groupLabel}>{g.label}</div>
                    <div className={styles.slots}>
                      {g.slots.map((s) => (
                        <button
                          key={s.startMin}
                          type="button"
                          disabled={!s.available}
                          aria-pressed={time === s.startMin}
                          aria-label={`${fmtMin(s.startMin)}${s.available ? '' : ' unavailable'}`}
                          className={[styles.slot, time === s.startMin && styles.slotSel]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => setTime(s.startMin)}
                        >
                          {fmtMin(s.startMin)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              : null}
            <div className={styles.small}>
              Struck-through times are already booked or too soon to book{noticeLabel}.
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className={styles.lead}>We only use these details for this appointment.</div>
            <div className={styles.fields}>
              <label className={styles.label}>
                Full name
                <input
                  className={styles.input}
                  autoComplete="name"
                  placeholder="Jordan Lee"
                  maxLength={120}
                  value={form.name}
                  aria-invalid={errors.name ? true : undefined}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <span className={styles.err}>{errors.name}</span>
              </label>
              <label className={styles.label}>
                <span>
                  Email{' '}
                  {props.requireEmail ? null : <span className={styles.optional}>Optional</span>}
                </span>
                <input
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  placeholder="jordan@email.com"
                  maxLength={254}
                  value={form.email}
                  aria-invalid={errors.email ? true : undefined}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <span className={styles.err}>{errors.email}</span>
              </label>
              <label className={styles.label}>
                Phone
                <span className={styles.phoneRow}>
                  <select
                    className={styles.input}
                    aria-label="Country code"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  >
                    {PHONE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} {c.dial}
                      </option>
                    ))}
                  </select>
                  <input
                    className={styles.input}
                    type="tel"
                    autoComplete="tel-national"
                    placeholder="(555) 014-2290"
                    maxLength={32}
                    value={form.phone}
                    aria-invalid={errors.phone ? true : undefined}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </span>
                <span className={styles.err}>{errors.phone}</span>
              </label>
              <label className={styles.label}>
                <span>
                  Notes <span className={styles.optional}>Optional</span>
                </span>
                <input
                  className={styles.input}
                  placeholder={copy.notesHint}
                  maxLength={500}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
                {props.template === 'consult' ? (
                  <span className={styles.small}>
                    Please don&rsquo;t include health details here.
                  </span>
                ) : null}
              </label>
              <label className={styles.hp} aria-hidden="true">
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </label>
            </div>
            <div className={styles.small}>
              Your phone number isn&rsquo;t verified; it&rsquo;s used to contact you about this
              booking.
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div className={styles.lead}>
              Check the details. Nothing is booked until you confirm.
            </div>
            <div className={styles.summary}>
              {summary.map((r) => (
                <div key={r.k} className={styles.summaryRow}>
                  <span>{r.k}</span>
                  <span>{r.v}</span>
                </div>
              ))}
            </div>
            {props.policyText ? <div className={styles.small}>{props.policyText}</div> : null}
            {submitErr ? (
              <div role="alert" className={styles.alert}>
                {submitErr}
              </div>
            ) : null}
          </>
        ) : null}

        {step === 2 && submitErr ? (
          <div role="alert" className={styles.alert}>
            {submitErr}
          </div>
        ) : null}

        {isDone && done ? (
          <>
            {!cancelled ? (
              <div className={styles.doneHead}>
                <span className={styles.check} aria-hidden="true">
                  ✓
                </span>
                <div className={styles.title} style={{ lineHeight: 1.05, marginTop: 6 }}>
                  {done.status === 'PENDING'
                    ? 'Request received.'
                    : resched
                      ? 'Rescheduled.'
                      : props.existing
                        ? 'Your appointment'
                        : "You're booked."}
                </div>
                <div className={styles.small} style={{ fontSize: 14 }}>
                  Confirmation <span className={styles.mono}>{done.confirmationCode}</span>
                  {done.emailed ? ` · sent to ${form.email}` : ''}
                  {done.status === 'PENDING' ? ` · ${props.businessName} will confirm it` : ''}
                </div>
              </div>
            ) : (
              <div className={styles.doneHead}>
                <div className={styles.title} style={{ lineHeight: 1.05 }}>
                  Appointment cancelled
                </div>
                <div className={styles.small} style={{ fontSize: 14 }}>
                  {done.confirmationCode} was cancelled. The time is open for others to book.
                </div>
              </div>
            )}
            <div className={styles.summary} style={{ opacity: cancelled ? 0.5 : 1 }}>
              {doneSummary.map((r) => (
                <div key={r.k} className={styles.summaryRow}>
                  <span>{r.k}</span>
                  <span>{r.v}</span>
                </div>
              ))}
            </div>
            {!cancelled ? (
              <>
                {askCancel ? (
                  <div
                    role="alertdialog"
                    aria-label="Cancel appointment"
                    className={styles.confirmBox}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Cancel this appointment?</div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.danger}
                        disabled={submitting}
                        onClick={doCancel}
                      >
                        Yes, cancel
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => setAskCancel(false)}
                      >
                        Keep appointment
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className={styles.actions}>
                  <button type="button" className={styles.primary} onClick={addToCalendar}>
                    Add to calendar
                  </button>
                  {done.managePath && !props.existing ? (
                    <a
                      className={styles.secondary}
                      href={done.managePath}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      Reschedule or cancel
                    </a>
                  ) : null}
                  {props.existing && canModify ? (
                    <>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => {
                          setResched(true);
                          setAskCancel(false);
                          setTime(null);
                          setStep(2);
                          void fetchAvailability(
                            props.existing!.serviceId,
                            props.existing!.staffId,
                            localDate(done.startAt, tz),
                          );
                        }}
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => setAskCancel(true)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
                {props.existing && !canModify ? (
                  <div className={styles.small}>
                    Online changes close {props.existing.cancellationWindowMin / 60} hours before
                    the appointment. Please contact the business.
                  </div>
                ) : null}
                {!props.existing && done.managePath ? (
                  <div className={styles.small}>
                    {done.emailed
                      ? 'The email includes a private link to manage this booking.'
                      : 'Bookmark this page — its address is your private link to reschedule or cancel.'}
                  </div>
                ) : null}
              </>
            ) : null}
            {submitErr ? (
              <div role="alert" className={styles.alert}>
                {submitErr}
              </div>
            ) : null}
            {props.demo ? (
              <>
                <button
                  type="button"
                  className={styles.primary}
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    setDone(null);
                    setStep(0);
                    setSvcId(null);
                    setStaffSel(null);
                    setTime(null);
                    setAvail(null);
                  }}
                >
                  Book another time
                </button>
                <div
                  className={styles.small}
                  style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11 }}
                >
                  Demo · no appointment was created and no email was sent.
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      {!isDone ? (
        <div className={styles.foot}>
          <div className={styles.footSummary}>{footerSummary}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && !(resched && step === 2) ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setStep(resched && step === 4 ? 2 : step - 1)}
              >
                Back
              </button>
            ) : null}
            {resched && step === 2 ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setResched(false);
                  setStep(5);
                }}
              >
                Keep current time
              </button>
            ) : null}
            <button
              type="button"
              className={[styles.primary, styles.next].join(' ')}
              disabled={!stepCanContinue}
              onClick={() => {
                if (!stepCanContinue) return;
                if (step === 2 && resched) return setStep(4);
                if (step === 3) {
                  if (validate()) setStep(4);
                  return;
                }
                if (step === 4) return void confirm();
                setStep(step + 1);
              }}
            >
              {step === 4
                ? submitting
                  ? 'Confirming…'
                  : resched
                    ? 'Confirm new time'
                    : 'Confirm booking'
                : 'Continue'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
