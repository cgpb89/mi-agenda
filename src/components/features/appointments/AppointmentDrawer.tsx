'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertDialog, Drawer } from '@/components/ui/Dialog';
import { Field, FormMessage, Input, Select } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { useShell } from '@/components/layout/AppShell';
import {
  fmtDay,
  fmtTime,
  localDateKey,
  localMinutes,
  moneyFmt,
} from '@/components/features/shared/format';
import {
  rescheduleAppointmentAction,
  transitionAppointmentAction,
} from '@/modules/bookings/actions';
import {
  getAppointmentDetailsAction,
  rescheduleOptionsAction,
} from '@/modules/bookings/drawer-actions';
import type { AppointmentDetails } from '@/modules/bookings/types';
import { recordPaymentAction, voidPaymentAction } from '@/modules/payments/actions';
import { addDaysIso, dayOptions, fmtMin } from './time-options';
import styles from './AppointmentDrawer.module.scss';

const SOURCE_LABEL = {
  ONLINE: 'Booked online',
  PHONE: 'Added by staff (phone)',
  WALK_IN: 'Walk-in',
} as const;
const CANCEL_REASONS = [
  'Customer asked to cancel',
  'Staff unavailable',
  'Booked by mistake',
  'Other',
];

/** Hook used by lists/calendar to open the drawer via `?appt=<id>`. */
export function useOpenAppointment() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (id) next.set('appt', id);
      else next.delete('appt');
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, params],
  );
}

export function AppointmentDrawer() {
  const params = useSearchParams();
  const id = params.get('appt');
  // Keyed by id: switching appointments remounts with fresh state.
  return id ? <AppointmentDrawerBody key={id} id={id} /> : null;
}

function AppointmentDrawerBody({ id }: { id: string }) {
  const { data, openNewAppointment } = useShell();
  const open = useOpenAppointment();
  const router = useRouter();
  const toast = useToast();
  const tz = data.tenant.timezone;

  const [d, setD] = useState<AppointmentDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'cancel' | 'no_show' | null>(null);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]!);
  const [resched, setResched] = useState<{ date: string; startMin: number } | null>(null);
  const [options, setOptions] = useState<{ startMin: number; available: boolean }[]>([]);
  const [pay, setPay] = useState<{
    kind: 'PAYMENT' | 'REFUND';
    amount: string;
    method: 'CASH' | 'CARD' | 'OTHER';
  } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const [nowMs] = useState(() => Date.now());

  const reload = useCallback(() => {
    void getAppointmentDetailsAction(data.tenant.slug, id).then((res) => {
      if (res.ok) {
        setD(res.data);
        setLoadError(null);
      } else setLoadError(res.error.message);
    });
  }, [id, data.tenant.slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!resched || !d) return;
    let cancelled = false;
    void rescheduleOptionsAction(data.tenant.slug, {
      appointmentId: d.id,
      date: resched.date,
    }).then((res) => {
      if (!cancelled) setOptions(res.ok ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [resched?.date, d, data.tenant.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => open(null);

  function afterChange(message: string) {
    toast(message);
    router.refresh();
    reload();
  }

  function transition(action: 'confirm' | 'cancel' | 'complete' | 'no_show', reason?: string) {
    if (!d) return;
    setActionError(null);
    startTransition(async () => {
      const res = await transitionAppointmentAction(data.tenant.slug, {
        appointmentId: d.id,
        action,
        reason,
      });
      setConfirm(null);
      if (!res.ok) return setActionError(res.error.message);
      afterChange(
        action === 'confirm'
          ? 'Appointment confirmed'
          : action === 'cancel'
            ? `Appointment cancelled · ${d.ref}`
            : action === 'complete'
              ? 'Marked as completed'
              : 'Marked as no-show',
      );
    });
  }

  function saveResched() {
    if (!d || !resched) return;
    startTransition(async () => {
      const res = await rescheduleAppointmentAction(data.tenant.slug, {
        appointmentId: d.id,
        ...resched,
      });
      if (!res.ok) return setActionError(res.error.message);
      setResched(null);
      afterChange(`Moved to ${fmtDay(res.data.startAt, tz)}, ${fmtTime(res.data.startAt, tz)}`);
    });
  }

  function savePayment() {
    if (!d || !pay) return;
    setPayError(null);
    startTransition(async () => {
      const res = await recordPaymentAction(data.tenant.slug, { appointmentId: d.id, ...pay });
      if (!res.ok) return setPayError(res.error.fieldErrors?.amount ?? res.error.message);
      setPay(null);
      afterChange(pay.kind === 'PAYMENT' ? 'Payment recorded' : 'Refund recorded');
    });
  }

  function doVoid() {
    if (!voidTarget) return;
    startTransition(async () => {
      const res = await voidPaymentAction(data.tenant.slug, {
        paymentId: voidTarget,
        reason: voidReason,
      });
      setVoidTarget(null);
      setVoidReason('');
      if (!res.ok) return setActionError(res.error.message);
      afterChange('Entry voided');
    });
  }

  const started = d ? new Date(d.startAt).getTime() <= nowMs : false;
  const active = d ? d.status === 'PENDING' || d.status === 'CONFIRMED' : false;
  const payLabel = !d
    ? ''
    : d.collectedMinor <= 0
      ? 'Not recorded'
      : d.collectedMinor >= d.quotedPriceMinor
        ? `${moneyFmt(d.collectedMinor, d.currency)} collected`
        : `${moneyFmt(d.collectedMinor, d.currency)} of ${moneyFmt(d.quotedPriceMinor, d.currency)}`;

  const actions: React.ReactNode[] = [];
  if (d && d.can.manage) {
    if (d.status === 'PENDING' && !started) {
      actions.push(
        <Button
          key="confirm"
          variant="primary"
          disabled={pending}
          onClick={() => transition('confirm')}
        >
          Confirm
        </Button>,
        <Button
          key="resched"
          disabled={pending}
          onClick={() =>
            setResched({ date: localDateKey(d.startAt, tz), startMin: localMinutes(d.startAt, tz) })
          }
        >
          Reschedule
        </Button>,
        <Button
          key="cancel"
          variant="danger"
          disabled={pending}
          onClick={() => setConfirm('cancel')}
        >
          Cancel
        </Button>,
      );
    } else if (active && !started) {
      actions.push(
        <Button
          key="resched"
          variant="primary"
          disabled={pending}
          onClick={() =>
            setResched({ date: localDateKey(d.startAt, tz), startMin: localMinutes(d.startAt, tz) })
          }
        >
          Reschedule
        </Button>,
        <Button
          key="cancel"
          variant="danger"
          disabled={pending}
          onClick={() => setConfirm('cancel')}
        >
          Cancel
        </Button>,
      );
    } else if (active && started) {
      actions.push(
        <Button
          key="complete"
          variant="primary"
          disabled={pending}
          onClick={() => transition('complete')}
        >
          Mark completed
        </Button>,
        <Button
          key="noshow"
          variant="danger"
          disabled={pending}
          onClick={() => setConfirm('no_show')}
        >
          Mark no-show
        </Button>,
      );
    }
  }
  if (d && !active && d.can.rebook && data.booking) {
    actions.push(
      <Button
        key="again"
        variant="primary"
        onClick={() => {
          const startDate = localDateKey(d.startAt, tz);
          const plus = addDaysIso(startDate, 28);
          const limit = addDaysIso(data.tenant.today, 30);
          close();
          openNewAppointment({
            customerId: d.customerId,
            customerName: d.contactName,
            serviceId: d.serviceId,
            staffId: d.staffId,
            date:
              plus > limit || plus < data.tenant.today ? addDaysIso(data.tenant.today, 1) : plus,
            startMin: localMinutes(d.startAt, tz),
          });
        }}
      >
        Book again
      </Button>,
    );
  }
  if (d && d.can.pay && d.status !== 'CANCELLED' && !pay) {
    actions.push(
      <Button
        key="pay"
        onClick={() =>
          setPay({
            kind: 'PAYMENT',
            amount: (Math.max(0, d.quotedPriceMinor - d.collectedMinor) / 100).toFixed(2),
            method: 'CASH',
          })
        }
      >
        Record payment
      </Button>,
    );
  }

  return (
    <>
      <Drawer
        open
        onClose={close}
        label="Appointment details"
        header={
          d ? (
            <div className={styles.meta}>
              <span className={styles.ref}>
                {d.ref} · {SOURCE_LABEL[d.source]}
              </span>
              <StatusPill status={d.status} size="sm" />
            </div>
          ) : (
            <span className={styles.ref}>Appointment</span>
          )
        }
        footer={actions.length ? <>{actions}</> : undefined}
      >
        {!d && !loadError ? <div className={styles.loading}>Loading…</div> : null}
        {loadError ? <FormMessage kind="error">{loadError}</FormMessage> : null}
        {d ? (
          <>
            <div className={styles.meta}>
              <span className={styles.svc}>{d.serviceName}</span>
              <span className={styles.when}>
                {fmtDay(d.startAt, tz, { weekday: 'long', month: 'long', day: 'numeric' })},{' '}
                {fmtTime(d.startAt, tz)}–{fmtTime(d.endAt, tz)} · {d.durationMin} min · with{' '}
                {d.staffName}
              </span>
            </div>
            <div className={styles.tiles}>
              <div className={styles.tile}>
                <span>Price</span>
                <span>
                  {d.quotedPriceMinor === 0 ? 'Free' : moneyFmt(d.quotedPriceMinor, d.currency)}
                </span>
              </div>
              <div className={styles.tile}>
                <span>Payment</span>
                <span>{payLabel}</span>
              </div>
            </div>
            {actionError ? <FormMessage kind="error">{actionError}</FormMessage> : null}
            {d.status === 'CANCELLED' && d.cancelReason ? (
              <span className={styles.small}>Cancelled · {d.cancelReason}</span>
            ) : null}

            <div className={styles.box}>
              <span className={styles.boxTitle}>Customer</span>
              <span className={styles.custName}>{d.contactName}</span>
              <span className={styles.small}>
                {[d.contactEmail, d.phone].filter(Boolean).join(' · ') || 'No contact details'}
              </span>
              <span className={styles.small}>
                {d.completedVisits} completed visit{d.completedVisits === 1 ? '' : 's'} ·{' '}
                {d.completedVisits === 0
                  ? 'first visit'
                  : `customer since ${new Date(d.customerSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: tz })}`}
              </span>
              {d.customerNote ? <span className={styles.quote}>“{d.customerNote}”</span> : null}
              {d.internalNote ? (
                <span className={styles.quote}>Staff note: {d.internalNote}</span>
              ) : null}
              <span className={styles.small} style={{ fontSize: 11 }}>
                Phone numbers are not verified.
              </span>
            </div>

            {resched ? (
              <div className={styles.resched}>
                <span style={{ fontWeight: 700 }}>Pick a new time</span>
                <div className={styles.row}>
                  <select
                    aria-label="New date"
                    value={resched.date}
                    onChange={(e) => setResched({ ...resched, date: e.target.value })}
                  >
                    {dayOptions(data.tenant.today).map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="New time"
                    value={resched.startMin}
                    onChange={(e) => setResched({ ...resched, startMin: Number(e.target.value) })}
                  >
                    {options.length === 0 ? (
                      <option value={resched.startMin}>Not working this day</option>
                    ) : null}
                    {options.map((o) => (
                      <option key={o.startMin} value={o.startMin} disabled={!o.available}>
                        {fmtMin(o.startMin)}
                        {o.available ? '' : ' · unavailable'}
                      </option>
                    ))}
                  </select>
                </div>
                {options.length > 0 &&
                !options.find((o) => o.startMin === resched.startMin)?.available ? (
                  <span role="alert" className={styles.err}>
                    Pick an available time.
                  </span>
                ) : null}
                <div className={styles.row}>
                  <Button
                    variant="primary"
                    disabled={
                      pending || !options.find((o) => o.startMin === resched.startMin)?.available
                    }
                    onClick={saveResched}
                  >
                    Move appointment
                  </Button>
                  <Button onClick={() => setResched(null)}>Keep current time</Button>
                </div>
              </div>
            ) : null}

            {pay ? (
              <div className={styles.resched}>
                <span style={{ fontWeight: 700 }}>
                  {pay.kind === 'PAYMENT' ? 'Record a payment' : 'Record a refund'}
                </span>
                <span className={styles.small}>
                  Record money you actually received in person. Tempo does not process payments.
                </span>
                <div className={styles.row}>
                  {d.can.void && d.collectedMinor > 0 ? (
                    <select
                      aria-label="Type"
                      value={pay.kind}
                      onChange={(e) =>
                        setPay({ ...pay, kind: e.target.value as 'PAYMENT' | 'REFUND' })
                      }
                    >
                      <option value="PAYMENT">Payment</option>
                      <option value="REFUND">Refund</option>
                    </select>
                  ) : null}
                  <input
                    aria-label="Amount"
                    inputMode="decimal"
                    value={pay.amount}
                    onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                    style={{ width: 110 }}
                  />
                  <select
                    aria-label="Method"
                    value={pay.method}
                    onChange={(e) =>
                      setPay({ ...pay, method: e.target.value as 'CASH' | 'CARD' | 'OTHER' })
                    }
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card (in person)</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                {payError ? (
                  <span role="alert" className={styles.err}>
                    {payError}
                  </span>
                ) : null}
                <div className={styles.row}>
                  <Button variant="primary" disabled={pending} onClick={savePayment}>
                    Save
                  </Button>
                  <Button onClick={() => setPay(null)}>Cancel</Button>
                </div>
              </div>
            ) : null}

            {d.payments.length ? (
              <div className={styles.box}>
                <span className={styles.boxTitle}>Payments recorded</span>
                <div className={styles.ledger}>
                  {d.payments.map((p) => (
                    <div
                      key={p.id}
                      className={[styles.ledgerRow, p.voided && styles.voided]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span>
                        {p.kind === 'PAYMENT' ? 'Payment' : 'Refund'} · {p.method.toLowerCase()} ·{' '}
                        {fmtDay(p.recordedAt, tz)}
                      </span>
                      <span>
                        {(p.kind === 'REFUND' ? '−' : '') + moneyFmt(p.amountMinor, d.currency)}
                      </span>
                      {d.can.void && !p.voided ? (
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => setVoidTarget(p.id)}
                        >
                          Void
                        </button>
                      ) : (
                        <span>{p.voided ? 'voided' : ''}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </Drawer>

      <AlertDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        title="Cancel this appointment?"
        actions={
          <>
            <Button onClick={() => setConfirm(null)}>Keep appointment</Button>
            <Button
              variant="dangerSolid"
              disabled={pending}
              onClick={() => transition('cancel', cancelReason)}
            >
              Cancel appointment
            </Button>
          </>
        }
      >
        {d ? (
          <p>
            {d.contactName} · {d.serviceName}, {fmtDay(d.startAt, tz)} at {fmtTime(d.startAt, tz)}.
            The time becomes bookable again.
          </p>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <Field label="Reason">
            {(p) => (
              <Select {...p} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
                {CANCEL_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </AlertDialog>

      <AlertDialog
        open={confirm === 'no_show'}
        onClose={() => setConfirm(null)}
        title="Mark as no-show?"
        actions={
          <>
            <Button onClick={() => setConfirm(null)}>Go back</Button>
            <Button variant="dangerSolid" disabled={pending} onClick={() => transition('no_show')}>
              Mark no-show
            </Button>
          </>
        }
      >
        {d
          ? `${d.contactName} didn't arrive for ${fmtTime(d.startAt, tz)}. This counts toward the no-show rate.`
          : null}
      </AlertDialog>

      <AlertDialog
        open={voidTarget !== null}
        onClose={() => setVoidTarget(null)}
        title="Void this entry?"
        actions={
          <>
            <Button onClick={() => setVoidTarget(null)}>Keep it</Button>
            <Button variant="dangerSolid" disabled={pending || !voidReason.trim()} onClick={doVoid}>
              Void entry
            </Button>
          </>
        }
      >
        <p>Voided entries stay in the history but no longer count toward collected revenue.</p>
        <div style={{ marginTop: 12 }}>
          <Field label="Reason, saved to the audit log">
            {(p) => (
              <Input
                {...p}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Required"
                maxLength={200}
              />
            )}
          </Field>
        </div>
      </AlertDialog>
    </>
  );
}
