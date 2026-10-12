'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { AlertDialog, Drawer, dialogStyles } from '@/components/ui/Dialog';
import { Field, FormMessage, Input, Textarea, formStyles } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import segStyles from '@/components/ui/Segmented.module.scss';
import tbl from '@/components/ui/Table.module.scss';
import { moneyFmt } from '@/components/features/shared/format';
import { deleteStaffAction, saveStaffAction } from '@/modules/staff/actions';
import { useI18n } from '@/i18n/client';

interface StaffRow {
  id: string;
  displayName: string;
  title: string;
  bio: string;
  isActive: boolean;
  serviceIds: string[];
  login: { email: string; role: 'OWNER' | 'MANAGER' | 'STAFF' | null } | null;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const { t, locale } = useI18n();
  const st = t.staff;

  function save() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const res = await saveStaffAction(slug, draft);
      if (!res.ok) return setError(res.error.message);
      toast(
        res.data.created
          ? st.toastAdded({ name: res.data.name })
          : st.toastSaved({ name: res.data.name }),
      );
      setDraft(null);
      router.refresh();
    });
  }

  function remove() {
    if (!draft?.id) return;
    const id = draft.id;
    startTransition(async () => {
      const res = await deleteStaffAction(slug, { id });
      setConfirmDelete(false);
      if (!res.ok) return setError(res.error.message);
      toast(st.toastDeleted({ name: res.data!.name }));
      setDraft(null);
      router.refresh();
    });
  }

  const current = draft?.id ? staff.find((s) => s.id === draft.id) : undefined;

  return (
    <>
      <PageHeader
        title={t.app.nav.staff}
        sub={st.sub({ n: staff.filter((s) => s.isActive).length })}
      />
      <PageContent>
        <div className={tbl.footer}>
          <span style={{ color: '#5d564b' }}>
            {st.intro} <Link href={`/app/${slug}/settings#team`}>{st.settingsLink}</Link>.
          </span>
          <Button
            data-tour="staff-add"
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
            {st.add}
          </Button>
        </div>
        <div className={tbl.wrap}>
          <table className={tbl.table} style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>{st.cols.name}</th>
                <th>{st.cols.services}</th>
                <th>{st.cols.login}</th>
                <th>{st.cols.upcoming}</th>
                <th>{st.cols.completed30}</th>
                <th className={tbl.right}>{st.cols.value30}</th>
                <th>{st.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr
                  key={s.id}
                  className={tbl.clickable}
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
                  <td className={tbl.muted}>
                    {st.nOfTotal({ n: s.serviceIds.length, total: services.length })}
                  </td>
                  <td className={tbl.muted}>
                    {s.login
                      ? `${s.login.role ? t.app.roles[s.login.role] : st.noAccess} · ${s.login.email}`
                      : st.calendarOnly}
                  </td>
                  <td className={tbl.mono}>{s.upcoming}</td>
                  <td className={tbl.mono}>{s.completed30}</td>
                  <td className={tbl.right}>{moneyFmt(s.value30, currency, locale)}</td>
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
        <span style={{ fontSize: 12, color: '#6b6358' }}>{st.valueNote}</span>
      </PageContent>

      <Drawer
        open={draft !== null}
        onClose={() => setDraft(null)}
        wide
        label={draft?.id ? st.edit : st.new}
        header={
          <span className={dialogStyles.modalTitle}>
            {draft?.id ? st.editNamed({ name: current?.displayName ?? '' }) : st.new}
          </span>
        }
        footer={
          <>
            <Button
              variant="primary"
              disabled={pending || !draft?.displayName.trim()}
              onClick={save}
            >
              {pending ? st.saving : st.save}
            </Button>
            {draft?.id ? (
              <Button
                variant={draft.isActive ? 'danger' : 'secondary'}
                onClick={() => setDraft({ ...draft, isActive: !draft.isActive })}
              >
                {draft.isActive ? st.markInactive : st.markActive}
              </Button>
            ) : null}
            {draft?.id ? (
              <Button
                variant="danger"
                disabled={pending}
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  setError(null);
                  setConfirmDelete(true);
                }}
              >
                {st.delete}
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
                {st.inactiveWarning({ n: current?.upcoming ?? 0 })}
              </FormMessage>
            ) : null}
            <div className={formStyles.grid2}>
              <Field label={st.name}>
                {(p) => (
                  <Input
                    {...p}
                    value={draft.displayName}
                    maxLength={80}
                    onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  />
                )}
              </Field>
              <Field label={st.role} hint={st.optional}>
                {(p) => (
                  <Input
                    {...p}
                    value={draft.title}
                    maxLength={80}
                    placeholder={st.rolePlaceholder}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <Field label={st.bio} hint={st.bioHint}>
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
                {st.servicesOffered}
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
                  <span style={{ fontSize: 13, color: '#6b6358' }}>{st.addServicesFirst}</span>
                ) : null}
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#6b6358' }}>
              {st.shiftsIn} <Link href={`/app/${slug}/availability`}>{st.availabilityLink}</Link>.
            </span>
          </>
        ) : null}
      </Drawer>

      <AlertDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={st.deleteTitle({ name: current?.displayName ?? '' })}
        actions={
          <>
            <Button onClick={() => setConfirmDelete(false)}>{st.keep}</Button>
            <Button variant="dangerSolid" disabled={pending} onClick={remove}>
              {st.delete}
            </Button>
          </>
        }
      >
        {st.deleteBody}
      </AlertDialog>
    </>
  );
}
