'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { AlertDialog, Drawer, dialogStyles } from '@/components/ui/Dialog';
import { Field, FormMessage, Input, Select, Textarea, formStyles } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import tbl from '@/components/ui/Table.module.scss';
import segStyles from '@/components/ui/Segmented.module.scss';
import { moneyFmt } from '@/components/features/shared/format';
import { saveServiceAction, setServiceActiveAction } from '@/modules/services/actions';
import { DURATIONS } from '@/modules/services/constants';
import { useI18n } from '@/i18n/client';
import type { Messages } from '@/i18n/messages';

export interface ServiceView {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceMinor: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  availableOn: 'ALL' | 'WEEKDAYS' | 'SATURDAYS';
  maxAdvanceDays: number | null;
  isActive: boolean;
  isOnline: boolean;
  staffIds: string[];
  booked30: number;
  upcoming: number;
}

interface Draft {
  id?: string;
  name: string;
  description: string;
  durationMin: number;
  price: string;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  staffIds: string[];
  availableOn: 'ALL' | 'WEEKDAYS' | 'SATURDAYS';
  maxAdvanceDays: string;
  isOnline: boolean;
  isActive: boolean;
}

function initials(n: string) {
  return n
    .replace(/^Dr\.\s+/, '')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2);
}

function bufferLabel(b: number, a: number, sv: Messages['services']) {
  if (!b && !a) return sv.none;
  if (b && a) return sv.bufferBoth({ b, a });
  return b ? sv.bufferBefore({ n: b }) : sv.bufferAfter({ n: a });
}

function blankDraft(staff: { id: string }[]): Draft {
  return {
    name: '',
    description: '',
    durationMin: 45,
    price: '30',
    bufferBeforeMin: 0,
    bufferAfterMin: 5,
    staffIds: staff[0] ? [staff[0].id] : [],
    availableOn: 'ALL',
    maxAdvanceDays: '',
    isOnline: true,
    isActive: true,
  };
}

export function ServicesView({
  services,
  staff,
  currency,
  openNew,
}: {
  services: ServiceView[];
  staff: { id: string; name: string }[];
  currency: string;
  openNew: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const slug = useShell().data.tenant.slug;
  const [draft, setDraft] = useState<Draft | null>(() => (openNew ? blankDraft(staff) : null));
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const { t, locale } = useI18n();
  const sv = t.services;

  const blank = (): Draft => blankDraft(staff);

  const edit = (s: ServiceView) => {
    setError(null);
    setDraft({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      price: (s.priceMinor / 100).toFixed(s.priceMinor % 100 ? 2 : 0),
      bufferBeforeMin: s.bufferBeforeMin,
      bufferAfterMin: s.bufferAfterMin,
      staffIds: s.staffIds,
      availableOn: s.availableOn,
      maxAdvanceDays: s.maxAdvanceDays ? String(s.maxAdvanceDays) : '',
      isOnline: s.isOnline,
      isActive: s.isActive,
    });
  };

  const close = () => {
    setDraft(null);
    setError(null);
    if (openNew) router.replace(`/app/${slug}/services`, { scroll: false });
  };

  const active = services.filter((s) => s.isActive).length;
  const current = draft?.id ? services.find((s) => s.id === draft.id) : undefined;

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const res = await saveServiceAction(slug, {
        ...draft,
        maxAdvanceDays: draft.maxAdvanceDays,
      });
      if (!res.ok)
        return setError({ message: res.error.message, fields: res.error.fieldErrors ?? {} });
      toast(
        res.data.created
          ? sv.toastAdded({ name: res.data.name })
          : sv.toastSaved({ name: res.data.name }),
      );
      close();
      router.refresh();
    });
  }

  function setActive(activeNext: boolean) {
    if (!draft?.id) return;
    startTransition(async () => {
      const res = await setServiceActiveAction(slug, { id: draft.id, active: activeNext });
      setConfirmDeactivate(false);
      if (!res.ok) return setError({ message: res.error.message, fields: {} });
      toast(
        activeNext
          ? sv.toastReactivated({ name: res.data.name })
          : sv.toastDeactivated({ name: res.data.name }),
      );
      close();
      router.refresh();
    });
  }

  const noStaff = draft ? draft.staffIds.length === 0 : false;
  const bad = !draft || !draft.name.trim() || noStaff;

  return (
    <>
      <PageHeader title={t.app.nav.services} />
      <PageContent>
        <div className={tbl.footer}>
          <span style={{ color: '#5d564b' }}>
            {sv.summary({ active, inactive: services.length - active, currency })}
          </span>
          <Button variant="primary" onClick={() => setDraft(blank())}>
            {sv.add}
          </Button>
        </div>
        <div className={tbl.wrap}>
          <table className={tbl.table} style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>{sv.cols.service}</th>
                <th>{sv.cols.duration}</th>
                <th>{sv.cols.buffer}</th>
                <th className={tbl.right}>{sv.cols.price}</th>
                <th>{sv.cols.staff}</th>
                <th>{sv.cols.booked30}</th>
                <th>{sv.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.id}
                  className={tbl.clickable}
                  tabIndex={0}
                  style={{ opacity: s.isActive ? 1 : 0.6 }}
                  onClick={() => edit(s)}
                  onKeyDown={(e) => e.key === 'Enter' && edit(s)}
                >
                  <td style={{ paddingTop: 12, paddingBottom: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 700 }}>{s.name}</span>
                      <span style={{ fontSize: 12, color: '#6b6358' }}>{s.description}</span>
                    </div>
                  </td>
                  <td>
                    {s.durationMin} {sv.min}
                  </td>
                  <td className={tbl.muted}>
                    {bufferLabel(s.bufferBeforeMin, s.bufferAfterMin, sv)}
                  </td>
                  <td className={tbl.right} style={{ fontWeight: 600 }}>
                    {s.priceMinor === 0 ? sv.free : moneyFmt(s.priceMinor, currency, locale)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {s.staffIds.map((id) => {
                        const p = staff.find((x) => x.id === id);
                        return p ? (
                          <span
                            key={id}
                            title={p.name}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: '#efebe4',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {initials(p.name)}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </td>
                  <td className={tbl.mono}>{s.booked30}</td>
                  <td>
                    {s.isActive ? (
                      <StatusPill
                        status="ACTIVE"
                        size="sm"
                        label={s.isOnline ? sv.active : sv.activeHidden}
                      />
                    ) : (
                      <StatusPill status="INACTIVE" size="sm" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {services.length === 0 ? (
            <div className={tbl.empty}>
              {sv.empty}{' '}
              <button type="button" className={tbl.linkBtn} onClick={() => setDraft(blank())}>
                {sv.addFirst}
              </button>
            </div>
          ) : null}
        </div>
      </PageContent>

      <Drawer
        open={draft !== null}
        onClose={close}
        wide
        label={draft?.id ? sv.edit : sv.new}
        header={
          <span className={dialogStyles.modalTitle}>
            {draft?.id ? sv.editNamed({ name: current?.name ?? '' }) : sv.new}
          </span>
        }
        footer={
          draft ? (
            <>
              <Button variant="primary" disabled={bad || pending} onClick={save}>
                {pending ? sv.saving : sv.save}
              </Button>
              {draft.id ? (
                draft.isActive ? (
                  <Button
                    variant="danger"
                    disabled={pending}
                    onClick={() => setConfirmDeactivate(true)}
                  >
                    {sv.deactivate}
                  </Button>
                ) : (
                  <Button disabled={pending} onClick={() => setActive(true)}>
                    {sv.reactivate}
                  </Button>
                )
              ) : null}
            </>
          ) : undefined
        }
      >
        {draft ? (
          <>
            {error ? <FormMessage kind="error">{error.message}</FormMessage> : null}
            <Field
              label={sv.name}
              error={error?.fields.name ?? (draft.name.trim() ? undefined : ' ')}
            >
              {(p) => (
                <Input
                  {...p}
                  value={draft.name}
                  maxLength={80}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              )}
            </Field>
            <Field label={sv.description} error={error?.fields.description}>
              {(p) => (
                <Textarea
                  {...p}
                  rows={2}
                  maxLength={300}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              )}
            </Field>
            <div className={formStyles.grid2} style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label={sv.duration}>
                {(p) => (
                  <Select
                    {...p}
                    value={draft.durationMin}
                    onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} {sv.min}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={sv.price({ currency })} error={error?.fields.price}>
                {(p) => (
                  <Input
                    {...p}
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  />
                )}
              </Field>
              <Field label={sv.bufferBeforeLabel}>
                {(p) => (
                  <Select
                    {...p}
                    value={draft.bufferBeforeMin}
                    onChange={(e) =>
                      setDraft({ ...draft, bufferBeforeMin: Number(e.target.value) })
                    }
                  >
                    {[0, 5, 10, 15].map((n) => (
                      <option key={n} value={n}>
                        {n ? `${n} ${sv.min}` : sv.none}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={sv.bufferAfterLabel}>
                {(p) => (
                  <Select
                    {...p}
                    value={draft.bufferAfterMin}
                    onChange={(e) => setDraft({ ...draft, bufferAfterMin: Number(e.target.value) })}
                  >
                    {[0, 5, 10, 15].map((n) => (
                      <option key={n} value={n}>
                        {n ? `${n} ${sv.min}` : sv.none}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5d564b' }}>
                {sv.whoOffers}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {staff.map((p) => {
                  const on = draft.staffIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      className={[segStyles.chip, on && segStyles.chipOn].filter(Boolean).join(' ')}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          staffIds: on
                            ? draft.staffIds.filter((x) => x !== p.id)
                            : [...draft.staffIds, p.id],
                        })
                      }
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              {noStaff ? (
                <span style={{ fontSize: 12, color: '#b3261e', fontWeight: 600 }}>
                  {sv.pickStaff}
                </span>
              ) : null}
            </div>
            <div className={formStyles.grid2} style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label={sv.availableOn}>
                {(p) => (
                  <Select
                    {...p}
                    value={draft.availableOn}
                    onChange={(e) =>
                      setDraft({ ...draft, availableOn: e.target.value as Draft['availableOn'] })
                    }
                  >
                    <option value="ALL">{sv.availability.ALL}</option>
                    <option value="WEEKDAYS">{sv.availability.WEEKDAYS}</option>
                    <option value="SATURDAYS">{sv.availability.SATURDAYS}</option>
                  </Select>
                )}
              </Field>
              <Field label={sv.bookableUpTo}>
                {(p) => (
                  <Select
                    {...p}
                    value={draft.maxAdvanceDays}
                    onChange={(e) => setDraft({ ...draft, maxAdvanceDays: e.target.value })}
                  >
                    <option value="">{sv.businessDefault}</option>
                    {[7, 14, 30].map((n) => (
                      <option key={n} value={String(n)}>
                        {sv.daysAhead({ n })}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <label className={formStyles.checkbox}>
              <input
                type="checkbox"
                checked={draft.isOnline}
                onChange={(e) => setDraft({ ...draft, isOnline: e.target.checked })}
              />
              {sv.showOnline}
            </label>
          </>
        ) : null}
      </Drawer>

      <AlertDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        title={sv.deactivateTitle({ name: current?.name ?? sv.thisService })}
        actions={
          <>
            <Button onClick={() => setConfirmDeactivate(false)}>{sv.keepActive}</Button>
            <Button variant="dangerSolid" disabled={pending} onClick={() => setActive(false)}>
              {sv.deactivate}
            </Button>
          </>
        }
      >
        {sv.deactivateBody({ n: current?.upcoming ?? 0 })}
      </AlertDialog>
    </>
  );
}
