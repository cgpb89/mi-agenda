'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertDialog, Drawer, dialogStyles } from '@/components/ui/Dialog';
import { Field, FormMessage, Input } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import tbl from '@/components/ui/Table.module.scss';
import {
  CATEGORY_VALUES,
  categoryLabel,
  templateLabel,
} from '@/components/features/shared/categories';
import {
  changePlanAction,
  recordPaymentAction,
  setTenantStatusAction,
} from '@/modules/platform/actions';
import { accessState, extendAccess } from '@/modules/billing/access';
import { PLANS, type PlanKey } from '@/modules/platform/constants';
import type { TenantRow } from '@/modules/platform/service';
import { AdminHeader } from './AdminShell';
import s from './Admin.module.scss';
import { useI18n } from '@/i18n/client';
import type { Messages } from '@/i18n/messages';

function fmtDate(iso: string, intl: string) {
  return new Date(iso).toLocaleDateString(intl, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ago(iso: string | null, bz: Messages['admin']['businesses']) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? bz.today : days === 1 ? bz.yesterday : bz.daysAgo({ n: days });
}

type Confirm =
  | { kind: 'suspend' }
  | { kind: 'reactivate' }
  | { kind: 'plan'; plan: PlanKey }
  | { kind: 'payment'; months: 1 | 12 }
  | null;

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
  const { t, intl } = useI18n();
  const bz = t.admin.businesses;
  const planLabel = (p: PlanKey) => t.settings.plans[p] ?? PLANS[p].label;
  const PAGE_LABEL = bz.page;

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
          : confirm.kind === 'payment'
            ? await recordPaymentAction({ tenantId: b.id, months: confirm.months, reason })
            : await setTenantStatusAction({ tenantId: b.id, action: confirm.kind, reason });
      if (!res.ok) {
        setError(res.error.fieldErrors?.reason ?? res.error.message);
        return;
      }
      toast(
        confirm.kind === 'plan'
          ? bz.toastPlan({ plan: planLabel(confirm.plan) })
          : confirm.kind === 'payment'
            ? bz.toastPayment({
                date: fmtDate(
                  extendAccess(new Date(b.accessUntil), confirm.months).toISOString(),
                  intl,
                ),
              })
            : confirm.kind === 'suspend'
              ? bz.toastSuspended({ name: b.name })
              : bz.toastReactivated({ name: b.name }),
      );
      setConfirm(null);
      setReason('');
      router.refresh();
    });
  }

  const seats = b ? PLANS[b.plan].staffSeats : null;
  const access = b ? accessState({ status: b.status, accessUntil: new Date(b.accessUntil) }) : null;
  const confirmCopy =
    b && confirm
      ? confirm.kind === 'suspend'
        ? {
            title: bz.suspendTitle({ name: b.name }),
            body: bz.suspendBody,
            cta: bz.suspendCta,
          }
        : confirm.kind === 'reactivate'
          ? {
              title: bz.reactivateTitle({ name: b.name }),
              body: bz.reactivateBody,
              cta: bz.reactivateCta,
            }
          : confirm.kind === 'payment'
            ? {
                title: bz.paymentTitle({ months: confirm.months }),
                body: bz.paymentBody({
                  name: b.name,
                  from: fmtDate(b.accessUntil, intl),
                  to: fmtDate(
                    extendAccess(new Date(b.accessUntil), confirm.months).toISOString(),
                    intl,
                  ),
                }),
                cta: bz.paymentCta,
              }
            : {
                title: bz.planTitle({ plan: planLabel(confirm.plan) }),
                body: bz.planBody({
                  name: b.name,
                  from: planLabel(b.plan),
                  to: planLabel(confirm.plan),
                }),
                cta: bz.planCta,
              }
      : null;

  return (
    <>
      <AdminHeader title={bz.title} sub={bz.sub({ n: tenants.length })} />
      <div className={s.content}>
        <div className={tbl.toolbar}>
          <input
            className={tbl.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={bz.search}
            aria-label={bz.searchLabel}
          />
          <select
            className={tbl.select}
            aria-label={bz.category}
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">{bz.allCategories}</option>
            {CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {t.common.categories[c]}
              </option>
            ))}
          </select>
          <select
            className={tbl.select}
            aria-label={bz.plan}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="all">{bz.allPlans}</option>
            {(Object.keys(PLANS) as PlanKey[]).map((p) => (
              <option key={p} value={p}>
                {planLabel(p)}
              </option>
            ))}
          </select>
          <select
            className={tbl.select}
            aria-label={bz.status}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">{bz.allStatuses}</option>
            {(['ACTIVE', 'TRIAL', 'SUSPENDED', 'CHURNED'] as const).map((k) => (
              <option key={k} value={k}>
                {t.common.status[k]}
              </option>
            ))}
          </select>
        </div>
        <div className={tbl.wrap} style={{ borderColor: '#e2e2dc' }}>
          <table className={tbl.table} style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th>{bz.cols.business}</th>
                <th>{bz.cols.category}</th>
                <th>{bz.cols.owner}</th>
                <th>{bz.cols.registered}</th>
                <th>{bz.cols.plan}</th>
                <th>{bz.cols.account}</th>
                <th>{bz.cols.page}</th>
                <th className={tbl.right}>{bz.cols.appts30}</th>
                <th>{bz.cols.lastActivity}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr
                  key={x.id}
                  className={tbl.clickable}
                  tabIndex={0}
                  onClick={() => open(x.id)}
                  onKeyDown={(e) => e.key === 'Enter' && open(x.id)}
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700 }}>{x.name}</span>
                      <span className={tbl.mono} style={{ fontSize: 11, color: '#62666d' }}>
                        /{x.slug}
                      </span>
                    </div>
                  </td>
                  <td>{categoryLabel(x.category, t)}</td>
                  <td>{x.owner}</td>
                  <td className={tbl.nowrap}>{fmtDate(x.createdAt, intl)}</td>
                  <td>{planLabel(x.plan)}</td>
                  <td>
                    <StatusPill status={x.status as 'ACTIVE'} size="sm" />
                  </td>
                  <td style={{ color: x.pageStatus === 'PUBLISHED' ? undefined : '#8a8e94' }}>
                    {PAGE_LABEL[x.pageStatus]}
                  </td>
                  <td className={`${tbl.right} ${tbl.mono}`}>{x.appts30}</td>
                  <td className={tbl.nowrap} style={{ color: '#62666d' }}>
                    {ago(x.lastActivity, bz)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <div className={tbl.empty}>
              {bz.noMatch}{' '}
              <button
                type="button"
                className={tbl.linkBtn}
                style={{ color: '#2f6e5a' }}
                onClick={() => {
                  setQ('');
                  setCat('all');
                  setPlan('all');
                  setStatus('all');
                }}
              >
                {bz.clearFilters}
              </button>
            </div>
          ) : null}
        </div>
        <span style={{ fontSize: 13, color: '#62666d' }}>
          {bz.footer({ n: rows.length, total: tenants.length })}
        </span>
      </div>

      <Drawer
        open={b !== null}
        onClose={() => setSelected(null)}
        wide
        label={bz.drawer}
        header={
          b ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}
            >
              <span className={dialogStyles.modalTitle} style={{ fontSize: 22 }}>
                {b.name}
              </span>
              <span style={{ fontSize: 13, color: '#62666d' }}>
                {bz.ownerLine({ category: categoryLabel(b.category, t), owner: b.owner })}
              </span>
              <StatusPill status={b.status as 'ACTIVE'} size="sm" />
            </div>
          ) : null
        }
        footer={
          b ? (
            b.status === 'SUSPENDED' ? (
              <Button onClick={() => setConfirm({ kind: 'reactivate' })}>
                {bz.reactivateAccount}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirm({ kind: 'suspend' })}>
                {bz.suspendAccount}
              </Button>
            )
          ) : undefined
        }
      >
        {b ? (
          <>
            <div className={s.tiles}>
              <div>
                <span>{bz.registered}</span>
                <span>{fmtDate(b.createdAt, intl)}</span>
              </div>
              <div>
                <span>{bz.lastActivity}</span>
                <span>{ago(b.lastActivity, bz)}</span>
              </div>
              <div>
                <span>{bz.appts30}</span>
                <span>{b.appts30}</span>
              </div>
              <div>
                <span>{bz.seats}</span>
                <span>
                  {bz.seatsValue({
                    n: b.staff,
                    max: seats === null ? bz.unlimited : String(seats),
                  })}
                </span>
              </div>
            </div>
            <div className={s.box}>
              <span className={s.boxTitle}>{bz.subscription}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className={tbl.select}
                  aria-label={bz.plan}
                  value={planPick}
                  onChange={(e) => setPlanPick(e.target.value as PlanKey)}
                >
                  {(Object.keys(PLANS) as PlanKey[]).map((p) => (
                    <option key={p} value={p}>
                      {planLabel(p)}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={planPick === b.plan}
                  onClick={() => setConfirm({ kind: 'plan', plan: planPick })}
                >
                  {bz.changePlan}
                </Button>
              </div>
              <span className={s.muted}>{bz.planNote}</span>
            </div>
            <div className={s.box}>
              <span className={s.boxTitle}>{bz.access}</span>
              <span style={{ fontWeight: 600 }}>
                {access!.phase === 'closed'
                  ? bz.accessClosed({
                      date: fmtDate(b.accessUntil, intl),
                      deleteOn: fmtDate(access!.deleteOn.toISOString(), intl),
                    })
                  : (access!.phase === 'trial' ? bz.accessTrial : bz.accessPaid)({
                      date: fmtDate(b.accessUntil, intl),
                      n: access!.daysLeft,
                    })}
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setConfirm({ kind: 'payment', months: 1 })}
                >
                  {bz.payMonth}
                </Button>
                <Button size="sm" onClick={() => setConfirm({ kind: 'payment', months: 12 })}>
                  {bz.payYear}
                </Button>
              </div>
              <span className={s.muted}>{bz.paymentNote}</span>
            </div>
            <div className={s.box}>
              <span className={s.boxTitle}>{bz.bookingPage}</span>
              <span style={{ fontWeight: 600 }}>
                {bz.templateLine({
                  page: PAGE_LABEL[b.pageStatus] ?? b.pageStatus,
                  template: templateLabel(b.template, t),
                })}
              </span>
              <span className={tbl.mono} style={{ color: '#62666d' }}>
                /book/{b.slug}
              </span>
              {b.pageStatus === 'PUBLISHED' && b.status !== 'SUSPENDED' ? (
                <a
                  href={`/book/${b.slug}`}
                  target="_blank"
                  rel="noopener"
                  style={{ fontWeight: 700, color: '#2f6e5a', fontSize: 13 }}
                >
                  {bz.openPublic}
                </a>
              ) : null}
            </div>
            <div className={s.privacy}>{bz.privacy}</div>
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
            <Button onClick={() => setConfirm(null)}>{bz.cancel}</Button>
            <Button
              variant={confirm?.kind === 'payment' ? 'primary' : 'dangerSolid'}
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
          <Field
            label={confirm?.kind === 'payment' ? bz.paymentRef : bz.reason}
            error={error ?? undefined}
          >
            {(p) => (
              <Input
                {...p}
                value={reason}
                maxLength={300}
                placeholder={bz.required}
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
