'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Drawer, dialogStyles } from '@/components/ui/Dialog';
import { Field, FormMessage, Input, Textarea, formStyles } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import segStyles from '@/components/ui/Segmented.module.scss';
import t from '@/components/ui/Table.module.scss';
import { moneyFmt } from '@/components/features/shared/format';
import { saveStaffAction } from '@/modules/staff/actions';

interface StaffRow {
  id: string;
  displayName: string;
  title: string;
  bio: string;
  isActive: boolean;
  serviceIds: string[];
  login: { email: string; role: string | null } | null;
  completed30: number;
  value30: number;
  upcoming: number;
}

type Draft = Omit<StaffRow, 'login' | 'completed30' | 'value30' | 'upcoming' | 'id'> & {
  id?: string;
};

export function StaffView({
  staff,
  services,
  currency,
}: {
  staff: StaffRow[];
  services: { id: string; name: string }[];
  currency: string;
}) {
  const { data } = useShell();
  const slug = data.tenant.slug;
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const res = await saveStaffAction(slug, draft);
      if (!res.ok) return setError(res.error.message);
      toast(`${res.data.name} ${res.data.created ? 'added' : 'saved'}`);
      setDraft(null);
      router.refresh();
    });
  }

  const current = draft?.id ? staff.find((s) => s.id === draft.id) : undefined;

  return (
    <>
      <PageHeader
        title="Staff"
        sub={`${staff.filter((s) => s.isActive).length} active · schedules live in Availability`}
      />
      <PageContent>
        <div className={t.footer}>
          <span style={{ color: '#5d564b' }}>
            Calendars for each person. To give someone a login, invite them from{' '}
            <Link href={`/app/${slug}/settings#team`}>Business settings</Link>.
          </span>
          <Button
            variant="primary"
            onClick={() =>
              setDraft({
                displayName: '',
                title: '',
                bio: '',
                isActive: true,
                serviceIds: services.map((s) => s.id),
              })
            }
          >
            + Add staff
          </Button>
        </div>
        <div className={t.wrap}>
          <table className={t.table} style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Services</th>
                <th>Login</th>
                <th>Upcoming</th>
                <th>Completed, 30 days</th>
                <th className={t.right}>Est. value, 30 days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr
                  key={s.id}
                  className={t.clickable}
                  tabIndex={0}
                  style={{ opacity: s.isActive ? 1 : 0.6 }}
                  onClick={() =>
                    setDraft({
                      id: s.id,
                      displayName: s.displayName,
                      title: s.title,
                      bio: s.bio,
                      isActive: s.isActive,
                      serviceIds: s.serviceIds,
                    })
                  }
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    setDraft({
                      id: s.id,
                      displayName: s.displayName,
                      title: s.title,
                      bio: s.bio,
                      isActive: s.isActive,
                      serviceIds: s.serviceIds,
                    })
                  }
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 700 }}>{s.displayName}</span>
                      <span style={{ fontSize: 12, color: '#6b6358' }}>{s.title}</span>
                    </div>
                  </td>
                  <td className={t.muted}>
                    {s.serviceIds.length} of {services.length}
                  </td>
                  <td className={t.muted}>
                    {s.login
                      ? `${s.login.role ? s.login.role[0] + s.login.role.slice(1).toLowerCase() : 'No access'} · ${s.login.email}`
                      : 'Calendar only'}
                  </td>
                  <td className={t.mono}>{s.upcoming}</td>
                  <td className={t.mono}>{s.completed30}</td>
                  <td className={t.right}>{moneyFmt(s.value30, currency)}</td>
                  <td>
                    {s.isActive ? (
                      <StatusPill status="ACTIVE" size="sm" />
                    ) : (
                      <StatusPill status="INACTIVE" size="sm" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span style={{ fontSize: 12, color: '#6b6358' }}>
          Estimated value is the price of completed appointments, not collected payments.
        </span>
      </PageContent>

      <Drawer
        open={draft !== null}
        onClose={() => setDraft(null)}
        wide
        label={draft?.id ? 'Edit staff member' : 'New staff member'}
        header={
          <span className={dialogStyles.modalTitle}>
            {draft?.id ? `Edit ${current?.displayName ?? ''}` : 'New staff member'}
          </span>
        }
        footer={
          <>
            <Button
              variant="primary"
              disabled={pending || !draft?.displayName.trim()}
              onClick={save}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
            {draft?.id ? (
              <Button
                variant={draft.isActive ? 'danger' : 'secondary'}
                onClick={() => setDraft({ ...draft, isActive: !draft.isActive })}
              >
                {draft.isActive ? 'Mark inactive' : 'Mark active'}
              </Button>
            ) : null}
          </>
        }
      >
        {draft ? (
          <>
            {error ? <FormMessage kind="error">{error}</FormMessage> : null}
            {!draft.isActive ? (
              <FormMessage kind="warning">
                Inactive staff are hidden from booking. {current?.upcoming ?? 0} upcoming
                appointment(s) stay booked — reassign or cancel them from the calendar.
              </FormMessage>
            ) : null}
            <div className={formStyles.grid2}>
              <Field label="Name">
                {(p) => (
                  <Input
                    {...p}
                    value={draft.displayName}
                    maxLength={80}
                    onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Role shown to customers" hint="Optional">
                {(p) => (
                  <Input
                    {...p}
                    value={draft.title}
                    maxLength={80}
                    placeholder="Senior barber"
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <Field label="Short bio" hint="Optional, shown on some templates">
              {(p) => (
                <Textarea
                  {...p}
                  rows={2}
                  maxLength={300}
                  value={draft.bio}
                  onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                />
              )}
            </Field>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5d564b' }}>
                Services they offer
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {services.map((s) => {
                  const on = draft.serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      className={[segStyles.chip, on && segStyles.chipOn].filter(Boolean).join(' ')}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          serviceIds: on
                            ? draft.serviceIds.filter((x) => x !== s.id)
                            : [...draft.serviceIds, s.id],
                        })
                      }
                    >
                      {s.name}
                    </button>
                  );
                })}
                {services.length === 0 ? (
                  <span style={{ fontSize: 13, color: '#6b6358' }}>Add services first.</span>
                ) : null}
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#6b6358' }}>
              Working days and shifts are set in{' '}
              <Link href={`/app/${slug}/availability`}>Availability</Link>.
            </span>
          </>
        ) : null}
      </Drawer>
    </>
  );
}
