'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, Kpi, KpiGrid } from '@/components/ui/Card';
import { Field, FormMessage, Input, Select, Textarea, formStyles } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import tbl from '@/components/ui/Table.module.scss';
import { fmtDay, fmtTime, moneyFmt } from '@/components/features/shared/format';
import { useOpenAppointment } from '@/components/features/appointments/AppointmentDrawer';
import { PHONE_COUNTRIES } from '@/lib/phone/countries';
import { updateCustomerAction } from '@/modules/customers/actions';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/i18n/client';
import { countryName } from '@/i18n/format';

type Status = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export function CustomerProfile({
  customer,
  appointments,
  canEdit,
}: {
  customer: {
    id: string;
    name: string;
    phoneE164: string;
    email: string;
    notes: string;
    createdAt: string;
  };
  appointments: {
    id: string;
    ref: string;
    startAt: string;
    status: Status;
    service: string;
    staff: string;
    priceMinor: number;
    currency: string;
    collectedMinor: number;
  }[];
  canEdit: boolean;
}) {
  const { data, openNewAppointment } = useShell();
  const { slug, timezone: tz, currency } = data.tenant;
  const router = useRouter();
  const toast = useToast();
  const openAppt = useOpenAppointment();
  const [form, setForm] = useState({
    name: customer.name,
    email: customer.email,
    phone: customer.phoneE164,
    phoneCountry: data.tenant.country,
    notes: customer.notes,
  });
  const [err, setErr] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const [pending, startTransition] = useTransition();
  const { t, locale } = useI18n();
  const pr = t.customers.profile;
  const money = (minor: number, cur: string) => moneyFmt(minor, cur, locale);

  const now = useNow();
  const completed = appointments.filter((a) => a.status === 'COMPLETED');
  const upcoming = appointments.filter(
    (a) =>
      (a.status === 'PENDING' || a.status === 'CONFIRMED') && new Date(a.startAt).getTime() > now,
  );
  const value = completed.reduce((s, a) => s + a.priceMinor, 0);
  const collected = appointments.reduce((s, a) => s + a.collectedMinor, 0);

  function save() {
    setErr(null);
    startTransition(async () => {
      const res = await updateCustomerAction(slug, { id: customer.id, ...form });
      if (!res.ok)
        return setErr({ message: res.error.message, fields: res.error.fieldErrors ?? {} });
      toast(pr.saved);
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title={customer.name}
        sub={<Link href={`/app/${slug}/customers`}>{pr.allCustomers}</Link>}
      />
      <PageContent>
        <KpiGrid>
          <Kpi
            label={pr.completedVisits}
            value={completed.length}
            note={pr.since({
              date: fmtDay(customer.createdAt, tz, locale, { month: 'short', year: 'numeric' }),
            })}
          />
          <Kpi
            label={pr.upcoming}
            value={upcoming.length}
            note={
              upcoming[0]
                ? pr.next({ date: fmtDay(upcoming[upcoming.length - 1]!.startAt, tz, locale) })
                : pr.noUpcoming
            }
          />
          <Kpi label={pr.lifetime} value={money(value, currency)} note={pr.lifetimeNote} />
          <Kpi label={pr.collected} value={money(collected, currency)} note={pr.collectedNote} />
        </KpiGrid>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <Card title={pr.details}>
            {err ? <FormMessage kind="error">{err.message}</FormMessage> : null}
            <Field label={pr.name} error={err?.fields.name}>
              {(p) => (
                <Input
                  {...p}
                  disabled={!canEdit}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              )}
            </Field>
            <div className={formStyles.grid2}>
              <Field label={pr.phoneCountry}>
                {(p) => (
                  <Select
                    {...p}
                    disabled={!canEdit}
                    value={form.phoneCountry}
                    onChange={(e) => setForm({ ...form, phoneCountry: e.target.value })}
                  >
                    {PHONE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {countryName(c.code, locale, c.name)} ({c.dial})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={pr.phone} hint={pr.unverified} error={err?.fields.phone}>
                {(p) => (
                  <Input
                    {...p}
                    type="tel"
                    disabled={!canEdit}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <Field label={pr.email} error={err?.fields.email}>
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  disabled={!canEdit}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              )}
            </Field>
            <Field label={pr.notes} hint={pr.staffOnly}>
              {(p) => (
                <Textarea
                  {...p}
                  disabled={!canEdit}
                  rows={3}
                  maxLength={1000}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              )}
            </Field>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canEdit ? (
                <Button variant="primary" disabled={pending} onClick={save}>
                  {pr.save}
                </Button>
              ) : null}
              {data.booking ? (
                <Button
                  onClick={() =>
                    openNewAppointment({ customerId: customer.id, customerName: customer.name })
                  }
                >
                  {pr.newAppointment}
                </Button>
              ) : null}
            </div>
          </Card>
          <Card title={pr.history} flush>
            <div className={tbl.wrap} style={{ border: 0 }}>
              <table className={tbl.table}>
                <thead>
                  <tr>
                    <th>{pr.date}</th>
                    <th>{pr.service}</th>
                    <th>{pr.status}</th>
                    <th className={tbl.right}>{pr.price}</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr
                      key={a.id}
                      className={tbl.clickable}
                      tabIndex={0}
                      onClick={() => openAppt(a.id)}
                      onKeyDown={(e) => e.key === 'Enter' && openAppt(a.id)}
                    >
                      <td className={tbl.nowrap}>
                        {fmtDay(a.startAt, tz, locale, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        · {fmtTime(a.startAt, tz, locale)}
                      </td>
                      <td>
                        {a.service} <span className={tbl.faint}>· {a.staff}</span>
                      </td>
                      <td>
                        <StatusPill status={a.status} size="sm" />
                      </td>
                      <td className={tbl.right}>{money(a.priceMinor, a.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {appointments.length === 0 ? (
                <div className={tbl.empty}>{pr.noAppointments}</div>
              ) : null}
            </div>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
