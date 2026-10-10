'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertDialog, Drawer, dialogStyles } from '@/components/ui/Dialog';
import { Field, FormMessage, Input } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import t from '@/components/ui/Table.module.scss';
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  templateLabel,
} from '@/components/features/shared/categories';
import { changePlanAction, setTenantStatusAction } from '@/modules/platform/actions';
import { PLANS, type PlanKey } from '@/modules/platform/constants';
import type { TenantRow } from '@/modules/platform/service';
import { AdminHeader } from './AdminShell';
import s from './Admin.module.scss';

const PAGE_LABEL: Record<string, string> = {
  PUBLISHED: 'Published',
  DRAFT: 'Draft',
  UNPUBLISHED: 'Unpublished',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ago(iso: string | null) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

type Confirm =
  { kind: 'suspend' } | { kind: 'reactivate' } | { kind: 'plan'; plan: PlanKey } | null;

export function BusinessesView({
  tenants,
  openId,
}: {
  tenants: TenantRow[];
  openId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [plan, setPlan] = useState('all');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<string | null>(openId);
  const [planPick, setPlanPick] = useState<PlanKey>('STARTER');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tenants.filter(
      (x) =>
        (!needle ||
          x.name.toLowerCase().includes(needle) ||
          x.owner.toLowerCase().includes(needle) ||
          x.slug.includes(needle)) &&
        (cat === 'all' || x.category === cat) &&
        (plan === 'all' || x.plan === plan) &&
        (status === 'all' || x.status === status),
    );
  }, [tenants, q, cat, plan, status]);

  const b = tenants.find((x) => x.id === selected) ?? null;

  function open(id: string) {
    const x = tenants.find((y) => y.id === id);
    if (x) setPlanPick(x.plan);
    setSelected(id);
    setError(null);
  }

  function run() {
    if (!b || !confirm) return;
    setError(null);
    startTransition(async () => {
      const res =
        confirm.kind === 'plan'
          ? await changePlanAction({ tenantId: b.id, plan: confirm.plan, reason })
          : await setTenantStatusAction({ tenantId: b.id, action: confirm.kind, reason });
      if (!res.ok) {
        setError(res.error.fieldErrors?.reason ?? res.error.message);
        return;
      }
      toast(
        confirm.kind === 'plan'
          ? `Plan changed to ${PLANS[confirm.plan].label}`
          : `${b.name} ${confirm.kind === 'suspend' ? 'suspended' : 'reactivated'}`,
      );
      setConfirm(null);
      setReason('');
      router.refresh();
    });
  }

  const seats = b ? PLANS[b.plan].staffSeats : null;
  const confirmCopy =
    b && confirm
      ? confirm.kind === 'suspend'
        ? {
            title: `Suspend ${b.name}?`,
            body: 'The booking page goes offline and the team is signed out and can no longer sign in. Existing appointments are kept.',
            cta: 'Suspend account',
          }
        : confirm.kind === 'reactivate'
          ? {
              title: `Reactivate ${b.name}?`,
              body: 'The booking page and team logins come back immediately.',
              cta: 'Reactivate',
            }
          : {
              title: `Change plan to ${PLANS[confirm.plan].label}?`,
              body: `${b.name} moves from ${PLANS[b.plan].label} to ${PLANS[confirm.plan].label}. Plans are labels in this release; no billing changes.`,
              cta: 'Change plan',
            }
      : null;

  return (
    <>
      <AdminHeader title="Businesses" sub={`${tenants.length} businesses`} />
      <div className={s.content}>
        <div className={t.toolbar}>
          <input
            className={t.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search business, owner or slug"
            aria-label="Search businesses"
          />
          <select
            className={t.select}
            aria-label="Category"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">All categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className={t.select}
            aria-label="Plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="all">All plans</option>
            {(Object.keys(PLANS) as PlanKey[]).map((p) => (
              <option key={p} value={p}>
                {PLANS[p].label}
              </option>
            ))}
          </select>
          <select
            className={t.select}
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CHURNED">Churned</option>
          </select>
        </div>
        <div className={t.wrap} style={{ borderColor: '#e2e2dc' }}>
          <table className={t.table} style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th>Business</th>
                <th>Category</th>
                <th>Owner</th>
                <th>Registered</th>
                <th>Plan</th>
                <th>Account</th>
                <th>Booking page</th>
                <th className={t.right}>Appts, 30 days</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr
                  key={x.id}
                  className={t.clickable}
                  tabIndex={0}
                  onClick={() => open(x.id)}
                  onKeyDown={(e) => e.key === 'Enter' && open(x.id)}
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700 }}>{x.name}</span>
                      <span className={t.mono} style={{ fontSize: 11, color: '#62666d' }}>
                        /{x.slug}
                      </span>
                    </div>
                  </td>
                  <td>{categoryLabel(x.category)}</td>
                  <td>{x.owner}</td>
                  <td className={t.nowrap}>{fmtDate(x.createdAt)}</td>
                  <td>{PLANS[x.plan].label}</td>
                  <td>
                    <StatusPill status={x.status as 'ACTIVE'} size="sm" />
                  </td>
                  <td style={{ color: x.pageStatus === 'PUBLISHED' ? undefined : '#8a8e94' }}>
                    {PAGE_LABEL[x.pageStatus]}
                  </td>
                  <td className={`${t.right} ${t.mono}`}>{x.appts30}</td>
                  <td className={t.nowrap} style={{ color: '#62666d' }}>
                    {ago(x.lastActivity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <div className={t.empty}>
              No businesses match.{' '}
              <button
                type="button"
                className={t.linkBtn}
                style={{ color: '#2f6e5a' }}
                onClick={() => {
                  setQ('');
                  setCat('all');
                  setPlan('all');
                  setStatus('all');
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>
        <span style={{ fontSize: 13, color: '#62666d' }}>
          {rows.length} of {tenants.length} businesses · appointment counts only, no customer data
        </span>
      </div>

      <Drawer
        open={b !== null}
        onClose={() => setSelected(null)}
        wide
        label="Business account"
        header={
          b ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}
            >
              <span className={dialogStyles.modalTitle} style={{ fontSize: 22 }}>
                {b.name}
              </span>
              <span style={{ fontSize: 13, color: '#62666d' }}>
                {categoryLabel(b.category)} · owner {b.owner}
              </span>
              <StatusPill status={b.status as 'ACTIVE'} size="sm" />
            </div>
          ) : null
        }
        footer={
          b ? (
            b.status === 'SUSPENDED' ? (
              <Button onClick={() => setConfirm({ kind: 'reactivate' })}>Reactivate account</Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirm({ kind: 'suspend' })}>
                Suspend account
              </Button>
            )
          ) : undefined
        }
      >
        {b ? (
          <>
            <div className={s.tiles}>
              <div>
                <span>Registered</span>
                <span>{fmtDate(b.createdAt)}</span>
              </div>
              <div>
                <span>Last activity</span>
                <span>{ago(b.lastActivity)}</span>
              </div>
              <div>
                <span>Appointments, 30 days</span>
                <span>{b.appts30}</span>
              </div>
              <div>
                <span>Staff seats</span>
                <span>
                  {b.staff} of {seats === null ? 'Unlimited' : seats}
                </span>
              </div>
            </div>
            <div className={s.box}>
              <span className={s.boxTitle}>SUBSCRIPTION</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className={t.select}
                  aria-label="Plan"
                  value={planPick}
                  onChange={(e) => setPlanPick(e.target.value as PlanKey)}
                >
                  {(Object.keys(PLANS) as PlanKey[]).map((p) => (
                    <option key={p} value={p}>
                      {PLANS[p].label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={planPick === b.plan}
                  onClick={() => setConfirm({ kind: 'plan', plan: planPick })}
                >
                  Change plan
                </Button>
              </div>
              <span className={s.muted}>
                Plan prices are placeholders until launch. Plans are labels only; limits are not
                enforced in this release.
              </span>
            </div>
            <div className={s.box}>
              <span className={s.boxTitle}>BOOKING PAGE</span>
              <span style={{ fontWeight: 600 }}>
                {PAGE_LABEL[b.pageStatus]} · {templateLabel(b.template)} template
              </span>
              <span className={t.mono} style={{ color: '#62666d' }}>
                /book/{b.slug}
              </span>
              {b.pageStatus === 'PUBLISHED' && b.status !== 'SUSPENDED' ? (
                <a
                  href={`/book/${b.slug}`}
                  target="_blank"
                  rel="noopener"
                  style={{ fontWeight: 700, color: '#2f6e5a', fontSize: 13 }}
                >
                  Open public page →
                </a>
              ) : null}
            </div>
            <div className={s.privacy}>
              Customer names, contacts and notes belong to the business and are hidden from platform
              admins. Support access through an owner-approved session is planned.
            </div>
          </>
        ) : null}
      </Drawer>

      <AlertDialog
        open={confirm !== null}
        onClose={() => {
          setConfirm(null);
          setReason('');
          setError(null);
        }}
        title={confirmCopy?.title ?? ''}
        actions={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="dangerSolid"
              disabled={pending || reason.trim().length < 3}
              onClick={run}
            >
              {confirmCopy?.cta}
            </Button>
          </>
        }
      >
        <p>{confirmCopy?.body}</p>
        <div style={{ marginTop: 12 }}>
          <Field label="Reason, saved to the audit log" error={error ?? undefined}>
            {(p) => (
              <Input
                {...p}
                value={reason}
                maxLength={300}
                placeholder="Required"
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
        </div>
        {error && !reason ? <FormMessage kind="error">{error}</FormMessage> : null}
      </AlertDialog>
    </>
  );
}
