'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Dialog';
import { Field, FormMessage, Input, Select, formStyles } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';
import { useShell } from '@/components/layout/AppShell';
import {
  checkSlotAction,
  createAppointmentAction,
  searchCustomersAction,
} from '@/modules/bookings/actions';
import { PHONE_COUNTRIES } from '@/lib/phone/countries';
import { dayOptions, money, quarterOptions } from './time-options';
import { useI18n } from '@/i18n/client';
import { countryName } from '@/i18n/format';

export interface NewAppointmentPrefill {
  staffId?: string;
  serviceId?: string;
  date?: string;
  startMin?: number;
  customerId?: string;
  customerName?: string;
}

export function NewAppointmentModal({
  open,
  prefill,
  onClose,
}: {
  open: boolean;
  prefill?: NewAppointmentPrefill;
  onClose: () => void;
}) {
  const { data } = useShell();
  const booking = data.booking!;
  const router = useRouter();
  const toast = useToast();
  const activeServices = booking.services.filter((s) => s.isActive);
  const { t, locale } = useI18n();
  const c = t.appointments.create;
  const quarters = useMemo(() => quarterOptions(locale), [locale]);

  const defaultService =
    activeServices.find((s) => s.id === prefill?.serviceId) ??
    activeServices.find((s) =>
      booking.staff.some((st) => st.id === booking.defaultStaffId && st.serviceIds.includes(s.id)),
    ) ??
    activeServices[0];

  // State initialises from the prefill; the shell remounts this component (key) on every open.
  const [customerId, setCustomerId] = useState<string>(prefill?.customerId ?? 'new');
  const [customerOpts, setCustomerOpts] = useState<{ id: string; name: string; phone: string }[]>(
    prefill?.customerId && prefill.customerName
      ? [{ id: prefill.customerId, name: prefill.customerName, phone: '' }]
      : [],
  );
  const [query, setQuery] = useState('');
  const [name, setName] = useState(prefill?.customerId ? '' : (prefill?.customerName ?? ''));
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState(data.tenant.country);
  const [email, setEmail] = useState('');
  const [serviceId, setServiceId] = useState(prefill?.serviceId ?? defaultService?.id ?? '');
  const [staffChoice, setStaffChoice] = useState(prefill?.staffId ?? booking.defaultStaffId ?? '');
  const [date, setDate] = useState(prefill?.date ?? data.tenant.today);
  const [startMin, setStartMin] = useState(prefill?.startMin ?? 13 * 60 + 30);
  const [notes, setNotes] = useState('');
  const [check, setCheck] = useState<{ key: string; ok: boolean; message: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const staffForService = useMemo(
    () => booking.staff.filter((s) => s.serviceIds.includes(serviceId)),
    [booking.staff, serviceId],
  );
  // Staff follows the service: fall back to the first person who offers it.
  const staffId = staffForService.some((s) => s.id === staffChoice)
    ? staffChoice
    : (staffForService[0]?.id ?? '');
  const checkKey = [serviceId, staffId, date, startMin].join('|');

  // Customer search (server-side, tenant-scoped).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      const res = await searchCustomersAction(data.tenant.slug, query);
      if (res.ok) {
        setCustomerOpts((prev) => {
          const keep = prev.filter((p) => p.id === customerId);
          return [...keep, ...res.data.filter((r) => !keep.some((k) => k.id === r.id))];
        });
      }
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, data.tenant.slug]);

  // Live conflict check (advisory; the server re-checks atomically on create).
  useEffect(() => {
    if (!open || !serviceId || !staffId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await checkSlotAction(data.tenant.slug, { serviceId, staffId, date, startMin });
      if (!cancelled)
        setCheck(
          res.ok
            ? { key: checkKey, ...res.data }
            : { key: checkKey, ok: false, message: res.error.message },
        );
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, serviceId, staffId, date, startMin, data.tenant.slug, checkKey]);

  const current = check && check.key === checkKey ? check : null;

  const isNew = customerId === 'new';
  const needsName = isNew && !name.trim();
  const invalid = !current?.ok || needsName || !serviceId || !staffId;

  let status: { kind: 'error' | 'warning' | 'success'; msg: string } | null = null;
  if (current && !current.ok) status = { kind: 'error', msg: current.message };
  else if (needsName) status = { kind: 'warning', msg: c.needsName };
  else if (current?.ok) status = { kind: 'success', msg: `✓ ${current.message}` };

  function submit() {
    setSubmitError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await createAppointmentAction(data.tenant.slug, {
        serviceId,
        staffId,
        date,
        startMin,
        customerId: isNew ? undefined : customerId,
        customerName: isNew ? name : undefined,
        phone: isNew ? phone : undefined,
        phoneCountry,
        email: isNew && email ? email : undefined,
        notes: notes || undefined,
        source: 'PHONE',
      });
      if (!res.ok) {
        setSubmitError(res.error.message);
        setFieldErrors(res.error.fieldErrors ?? {});
        return;
      }
      toast(c.created({ ref: res.data.ref }));
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={c.title}
      footer={
        <>
          <Button onClick={onClose}>{c.cancel}</Button>
          <Button variant="primary" onClick={submit} disabled={invalid || pending}>
            {pending ? c.creating : c.create}
          </Button>
        </>
      }
    >
      <div
        className={formStyles.grid2}
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}
      >
        <Field label={c.findCustomer} full>
          {(p) => (
            <Input
              {...p}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={c.searchPlaceholder}
            />
          )}
        </Field>
        <Field label={c.customer} full error={fieldErrors.customerId}>
          {(p) => (
            <Select {...p} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="new">{c.newCustomer}</option>
              {customerOpts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {isNew ? (
          <>
            <Field label={c.name} error={fieldErrors.n}>
              {(p) => (
                <Input
                  {...p}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={c.namePlaceholder}
                  maxLength={120}
                />
              )}
            </Field>
            <Field label={c.email} hint={c.optional} error={fieldErrors.email}>
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={c.optionalWalkIns}
                />
              )}
            </Field>
            <Field label={c.phoneCountry}>
              {(p) => (
                <Select
                  {...p}
                  value={phoneCountry}
                  onChange={(e) => setPhoneCountry(e.target.value)}
                >
                  {PHONE_COUNTRIES.map((pc) => (
                    <option key={pc.code} value={pc.code}>
                      {countryName(pc.code, locale, pc.name)} ({pc.dial})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={c.phone} hint={c.optionalWalkIns} error={fieldErrors.phone}>
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={c.phonePlaceholder}
                />
              )}
            </Field>
          </>
        ) : null}
        <Field label={c.service}>
          {(p) => (
            <Select {...p} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {activeServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.durationMin} {t.appointments.min} ·{' '}
                  {money(s.priceMinor, s.currency, locale)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={c.staff}>
          {(p) => (
            <Select {...p} value={staffId} onChange={(e) => setStaffChoice(e.target.value)}>
              {staffForService.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={c.date}>
          {(p) => (
            <Select {...p} value={date} onChange={(e) => setDate(e.target.value)}>
              {dayOptions(data.tenant.today, locale).map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={c.startTime}>
          {(p) => (
            <Select {...p} value={startMin} onChange={(e) => setStartMin(Number(e.target.value))}>
              {quarters.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={c.notes} full>
          {(p) => (
            <Input
              {...p}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={c.notesPlaceholder}
              maxLength={1000}
            />
          )}
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          {status ? <FormMessage kind={status.kind}>{status.msg}</FormMessage> : null}
        </div>
        {submitError ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <FormMessage kind="error">{submitError}</FormMessage>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
