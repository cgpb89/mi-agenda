'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { AlertDialog, Drawer, dialogStyles } from '@/components/ui/Dialog';
import { Field, FormMessage, Input, Select, Textarea, formStyles } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import t from '@/components/ui/Table.module.scss';
import segStyles from '@/components/ui/Segmented.module.scss';
import { moneyFmt } from '@/components/features/shared/format';
import { saveServiceAction, setServiceActiveAction } from '@/modules/services/actions';
import { DURATIONS } from '@/modules/services/constants';

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

function bufferLabel(b: number, a: number) {
  if (!b && !a) return 'None';
  if (b && a) return `${b} before, ${a} after`;
  return b ? `${b} before` : `${a} after`;
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
      toast(`${res.data.name} ${res.data.created ? 'added' : 'saved'}`);
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
      toast(`${res.data.name} ${activeNext ? 'reactivated' : 'deactivated'}`);
      close();
      router.refresh();
    });
  }

  const noStaff = draft ? draft.staffIds.length === 0 : false;
  const bad = !draft || !draft.name.trim() || noStaff;

  return (
    <>
      <PageHeader title="Services" />
      <PageContent>
        <div className={t.footer}>
          <span style={{ color: '#5d564b' }}>
            {active} active · {services.length - active} inactive · prices in {currency}
          </span>
          <Button variant="primary" onClick={() => setDraft(blank())}>
            + Add service
          </Button>
        </div>
        <div className={t.wrap}>
          <table className={t.table} style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Service</th>
                <th>Duration</th>
                <th>Buffer</th>
                <th className={t.right}>Price</th>
                <th>Staff</th>
                <th>Booked, last 30 days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.id}
                  className={t.clickable}
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
                  <td>{s.durationMin} min</td>
                  <td className={t.muted}>{bufferLabel(s.bufferBeforeMin, s.bufferAfterMin)}</td>
                  <td className={t.right} style={{ fontWeight: 600 }}>
                    {s.priceMinor === 0 ? 'Free' : moneyFmt(s.priceMinor, currency)}
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
                  <td className={t.mono}>{s.booked30}</td>
                  <td>
                    {s.isActive ? (
                      <StatusPill
                        status="ACTIVE"
                        size="sm"
                        label={s.isOnline ? 'Active' : 'Active · hidden online'}
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
            <div className={t.empty}>
              No services yet.{' '}
              <button type="button" className={t.linkBtn} onClick={() => setDraft(blank())}>
                Add your first service
              </button>
            </div>
          ) : null}
        </div>
      </PageContent>

      <Drawer
        open={draft !== null}
        onClose={close}
        wide
        label={draft?.id ? 'Edit service' : 'New service'}
        header={
          <span className={dialogStyles.modalTitle}>
            {draft?.id ? `Edit ${current?.name ?? ''}` : 'New service'}
          </span>
        }
        footer={
          draft ? (
            <>
              <Button variant="primary" disabled={bad || pending} onClick={save}>
                {pending ? 'Saving…' : 'Save service'}
              </Button>
              {draft.id ? (
                draft.isActive ? (
                  <Button
                    variant="danger"
                    disabled={pending}
                    onClick={() => setConfirmDeactivate(true)}
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button disabled={pending} onClick={() => setActive(true)}>
                    Reactivate
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
              label="Service name"
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
            <Field label="Description" error={error?.fields.description}>
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
              <Field label="Duration">
                {(p) => (
                  <Select
                    {...p}
                    value={draft.durationMin}
                    onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={`Price (${currency})`} error={error?.fields.price}>
                {(p) => (
                  <Input
                    {...p}
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Buffer before">
                {(p) => (
                  <Select
                    {...p}
                    value={draft.bufferBeforeMin}
                    onChange={(e) =>
                      setDraft({ ...draft, bufferBeforeMin: Number(e.target.value) })
                    }
                  >
                    <option value={0}>None</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                  </Select>
                )}
              </Field>
              <Field label="Buffer after">
                {(p) => (
                  <Select
                    {...p}
                    value={draft.bufferAfterMin}
                    onChange={(e) => setDraft({ ...draft, bufferAfterMin: Number(e.target.value) })}
                  >
                    <option value={0}>None</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                  </Select>
                )}
              </Field>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5d564b' }}>Who offers it</span>
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
                  Pick at least one person, or customers can&rsquo;t book it.
                </span>
              ) : null}
            </div>
            <div className={formStyles.grid2} style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Available on">
                {(p) => (
                  <Select
                    {...p}
                    value={draft.availableOn}
                    onChange={(e) =>
                      setDraft({ ...draft, availableOn: e.target.value as Draft['availableOn'] })
                    }
                  >
                    <option value="ALL">Any working day</option>
                    <option value="WEEKDAYS">Weekdays only</option>
                    <option value="SATURDAYS">Saturdays only</option>
                  </Select>
                )}
              </Field>
              <Field label="Bookable up to">
                {(p) => (
                  <Select
                    {...p}
                    value={draft.maxAdvanceDays}
                    onChange={(e) => setDraft({ ...draft, maxAdvanceDays: e.target.value })}
                  >
                    <option value="">Business default</option>
                    <option value="7">7 days ahead</option>
                    <option value="14">14 days ahead</option>
                    <option value="30">30 days ahead</option>
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
              Show on the public booking page
            </label>
          </>
        ) : null}
      </Drawer>

      <AlertDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        title={`Deactivate ${current?.name ?? 'service'}?`}
        actions={
          <>
            <Button onClick={() => setConfirmDeactivate(false)}>Keep active</Button>
            <Button variant="dangerSolid" disabled={pending} onClick={() => setActive(false)}>
              Deactivate
            </Button>
          </>
        }
      >
        It disappears from your booking page. {current?.upcoming ?? 0} upcoming appointment
        {current?.upcoming === 1 ? '' : 's'} stay booked.
      </AlertDialog>
    </>
  );
}
