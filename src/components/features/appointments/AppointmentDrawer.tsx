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
import { useI18n } from '@/i18n/client';
import { CUSTOMER_CANCEL_REASON } from '@/modules/bookings/rules';

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
  const { t, locale, intl } = useI18n();
  const dr = t.appointments.drawer;
  const money = (minor: number, currency: string) => moneyFmt(minor, currency, locale);
  const day = (iso: string, opts?: Intl.DateTimeFormatOptions) => fmtDay(iso, tz, locale, opts);
  const time = (iso: string) => fmtTime(iso, tz, locale);

  const [d, setD] = useState<AppointmentDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'cancel' | 'no_show' | null>(null);
  const [cancelReason, setCancelReason] = useState(dr.cancelReasons[0]!);
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
          ? dr.toastConfirmed
          : action === 'cancel'
            ? dr.toastCancelled({ ref: d.ref })
            : action === 'complete'
              ? dr.toastCompleted
              : dr.toastNoShow,
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
      afterChange(dr.toastMoved({ when: `${day(res.data.startAt)}, ${time(res.data.startAt)}` }));
    });
  }

  function savePayment() {
    if (!d || !pay) return;
    setPayError(null);
    startTransition(async () => {
      const res = await recordPaymentAction(data.tenant.slug, { appointmentId: d.id, ...pay });
      if (!res.ok) return setPayError(res.error.fieldErrors?.amount ?? res.error.message);
      setPay(null);
      afterChange(pay.kind === 'PAYMENT' ? dr.toastPayment : dr.toastRefund);
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
      afterChange(dr.toastVoided);
    });
  }

  const started = d ? new Date(d.startAt).getTime() <= nowMs : false;
  const active = d ? d.status === 'PENDING' || d.status === 'CONFIRMED' : false;
  const payLabel = !d
    ? ''
    : d.collectedMinor <= 0
      ? t.appointments.list.notRecorded
      : d.collectedMinor >= d.quotedPriceMinor
        ? t.appointments.list.collected({ amount: money(d.collectedMinor, d.currency) })
        : t.appointments.list.partOf({
            amount: money(d.collectedMinor, d.currency),
            total: money(d.quotedPriceMinor, d.currency),
          });

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
          {dr.confirm}
        </Button>,
        <Button
          key="resched"
          disabled={pending}
          onClick={() =>
            setResched({ date: localDateKey(d.startAt, tz), startMin: localMinutes(d.startAt, tz) })
          }
        >
          {dr.reschedule}
        </Button>,
        <Button
          key="cancel"
          variant="danger"
          disabled={pending}
          onClick={() => setConfirm('cancel')}
        >
          {dr.cancel}
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
          {dr.reschedule}
        </Button>,
        <Button
          key="cancel"
          variant="danger"
          disabled={pending}
          onClick={() => setConfirm('cancel')}
        >
          {dr.cancel}
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
          {dr.markCompleted}
        </Button>,
        <Button
          key="noshow"
          variant="danger"
          disabled={pending}
          onClick={() => setConfirm('no_show')}
        >
          {dr.markNoShow}
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
        {dr.bookAgain}
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
        {dr.recordPayment}
      </Button>,
    );
  }

  return (
    <>
      <Drawer
        open
        onClose={close}
        label={dr.label}
        header={
          d ? (
            <div className={styles.meta}>
              <span className={styles.ref}>
                {d.ref} · {dr.source[d.source]}
              </span>
              <StatusPill status={d.status} size="sm" />
            </div>
          ) : (
            <span className={styles.ref}>{dr.appointment}</span>
          )
        }
        footer={actions.length ? <>{actions}</> : undefined}
      >
        {!d && !loadError ? <div className={styles.loading}>{dr.loading}</div> : null}
        {loadError ? <FormMessage kind="error">{loadError}</FormMessage> : null}
        {d ? (
          <>
            <div className={styles.meta}>
              <span className={styles.svc}>{d.serviceName}</span>
              <span className={styles.when}>
                {day(d.startAt, { weekday: 'long', month: 'long', day: 'numeric' })},{' '}
                {time(d.startAt)}–{time(d.endAt)} · {d.durationMin} {t.appointments.min} ·{' '}
                {dr.with({ staff: d.staffName })}
              </span>
            </div>
            <div className={styles.tiles}>
              <div className={styles.tile}>
                <span>{dr.price}</span>
                <span>
                  {d.quotedPriceMinor === 0
                    ? t.appointments.free
                    : money(d.quotedPriceMinor, d.currency)}
                </span>
              </div>
              <div className={styles.tile}>
                <span>{dr.payment}</span>
                <span>{payLabel}</span>
              </div>
            </div>
            {actionError ? <FormMessage kind="error">{actionError}</FormMessage> : null}
            {d.status === 'CANCELLED' && d.cancelReason ? (
              <span className={styles.small}>
                {dr.cancelledReason({
                  reason:
                    d.cancelReason === CUSTOMER_CANCEL_REASON
                      ? dr.cancelledByCustomer
                      : d.cancelReason,
                })}
              </span>
            ) : null}

            <div className={styles.box}>
              <span className={styles.boxTitle}>{dr.customer}</span>
              <span className={styles.custName}>{d.contactName}</span>
              <span className={styles.small}>
                {[d.contactEmail, d.phone].filter(Boolean).join(' · ') || dr.noContact}
              </span>
              <span className={styles.small}>
                {dr.visits({ n: d.completedVisits })} ·{' '}
                {d.completedVisits === 0
                  ? dr.firstVisit
                  : dr.customerSince({
                      date: new Date(d.customerSince).toLocaleDateString(intl, {
                        month: 'short',
                        year: 'numeric',
                        timeZone: tz,
                      }),
                    })}
              </span>
              {d.customerNote ? <span className={styles.quote}>“{d.customerNote}”</span> : null}
              {d.internalNote ? (
                <span className={styles.quote}>{dr.staffNote({ note: d.internalNote })}</span>
              ) : null}
              <span className={styles.small} style={{ fontSize: 11 }}>
                {dr.phoneNotVerified}
              </span>
            </div>

            {resched ? (
              <div className={styles.resched}>
                <span style={{ fontWeight: 700 }}>{dr.pickNewTime}</span>
                <div className={styles.row}>
                  <select
                    aria-label={dr.newDate}
                    value={resched.date}
                    onChange={(e) => setResched({ ...resched, date: e.target.value })}
                  >
                    {dayOptions(data.tenant.today, locale).map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={dr.newTime}
                    value={resched.startMin}
                    onChange={(e) => setResched({ ...resched, startMin: Number(e.target.value) })}
                  >
                    {options.length === 0 ? (
                      <option value={resched.startMin}>{dr.notWorking}</option>
                    ) : null}
                    {options.map((o) => (
                      <option key={o.startMin} value={o.startMin} disabled={!o.available}>
                        {fmtMin(o.startMin, locale)}
                        {o.available ? '' : dr.unavailable}
                      </option>
                    ))}
                  </select>
                </div>
                {options.length > 0 &&
                !options.find((o) => o.startMin === resched.startMin)?.available ? (
                  <span role="alert" className={styles.err}>
                    {dr.pickAvailable}
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
                    {dr.move}
                  </Button>
                  <Button onClick={() => setResched(null)}>{dr.keepTime}</Button>
                </div>
              </div>
            ) : null}

            {pay ? (
              <div className={styles.resched}>
                <span style={{ fontWeight: 700 }}>
                  {pay.kind === 'PAYMENT' ? dr.recordAPayment : dr.recordARefund}
                </span>
                <span className={styles.small}>{dr.payHint}</span>
                <div className={styles.row}>
                  {d.can.void && d.collectedMinor > 0 ? (
                    <select
                      aria-label={dr.type}
                      value={pay.kind}
                      onChange={(e) =>
                        setPay({ ...pay, kind: e.target.value as 'PAYMENT' | 'REFUND' })
                      }
                    >
                      <option value="PAYMENT">{dr.paymentKind}</option>
                      <option value="REFUND">{dr.refundKind}</option>
                    </select>
                  ) : null}
                  <input
                    aria-label={dr.amount}
                    inputMode="decimal"
                    value={pay.amount}
                    onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                    style={{ width: 110 }}
                  />
                  <select
                    aria-label={dr.method}
                    value={pay.method}
                    onChange={(e) =>
                      setPay({ ...pay, method: e.target.value as 'CASH' | 'CARD' | 'OTHER' })
                    }
                  >
                    <option value="CASH">{dr.methods.CASH}</option>
                    <option value="CARD">{dr.methods.CARD}</option>
                    <option value="OTHER">{dr.methods.OTHER}</option>
                  </select>
                </div>
                {payError ? (
                  <span role="alert" className={styles.err}>
                    {payError}
                  </span>
                ) : null}
                <div className={styles.row}>
                  <Button variant="primary" disabled={pending} onClick={savePayment}>
                    {dr.save}
                  </Button>
                  <Button onClick={() => setPay(null)}>{dr.cancel}</Button>
                </div>
              </div>
            ) : null}

            {d.payments.length ? (
              <div className={styles.box}>
                <span className={styles.boxTitle}>{dr.paymentsRecorded}</span>
                <div className={styles.ledger}>
                  {d.payments.map((p) => (
                    <div
                      key={p.id}
                      className={[styles.ledgerRow, p.voided && styles.voided]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span>
                        {p.kind === 'PAYMENT' ? dr.paymentKind : dr.refundKind} ·{' '}
                        {dr.methodShort[p.method as keyof typeof dr.methodShort] ??
                          p.method.toLowerCase()}{' '}
                        · {day(p.recordedAt)}
                      </span>
                      <span>
                        {(p.kind === 'REFUND' ? '−' : '') + money(p.amountMinor, d.currency)}
                      </span>
                      {d.can.void && !p.voided ? (
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => setVoidTarget(p.id)}
                        >
                          {dr.void}
                        </button>
                      ) : (
                        <span>{p.voided ? dr.voided : ''}</span>
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
        title={dr.cancelTitle}
        actions={
          <>
            <Button onClick={() => setConfirm(null)}>{dr.keepAppointment}</Button>
            <Button
              variant="dangerSolid"
              disabled={pending}
              onClick={() => transition('cancel', cancelReason)}
            >
              {dr.cancelAppointment}
            </Button>
          </>
        }
      >
        {d ? (
          <p>
            {dr.cancelBody({
              customer: d.contactName,
              service: d.serviceName,
              day: day(d.startAt),
              time: time(d.startAt),
            })}
          </p>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <Field label={dr.reason}>
            {(p) => (
              <Select {...p} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
                {dr.cancelReasons.map((r) => (
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
        title={dr.noShowTitle}
        actions={
          <>
            <Button onClick={() => setConfirm(null)}>{dr.goBack}</Button>
            <Button variant="dangerSolid" disabled={pending} onClick={() => transition('no_show')}>
              {dr.markNoShow}
            </Button>
          </>
        }
      >
        {d ? dr.noShowBody({ customer: d.contactName, time: time(d.startAt) }) : null}
      </AlertDialog>

      <AlertDialog
        open={voidTarget !== null}
        onClose={() => setVoidTarget(null)}
        title={dr.voidTitle}
        actions={
          <>
            <Button onClick={() => setVoidTarget(null)}>{dr.keepIt}</Button>
            <Button variant="dangerSolid" disabled={pending || !voidReason.trim()} onClick={doVoid}>
              {dr.voidEntry}
            </Button>
          </>
        }
      >
        <p>{dr.voidBody}</p>
        <div style={{ marginTop: 12 }}>
          <Field label={dr.voidReason}>
            {(p) => (
              <Input
                {...p}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={dr.required}
                maxLength={200}
              />
            )}
          </Field>
        </div>
      </AlertDialog>
    </>
  );
}
