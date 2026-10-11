'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertDialog } from '@/components/ui/Dialog';
import { Field, FormMessage, Input } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import tbl from '@/components/ui/Table.module.scss';
import { platformChangeRoleAction, setUserStatusAction } from '@/modules/platform/actions';
import { AdminHeader } from './AdminShell';
import s from './Admin.module.scss';
import { useI18n } from '@/i18n/client';

interface U {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  business: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  status: 'ACTIVE' | 'SUSPENDED';
  isAdmin: boolean;
  registered: string;
  lastActive: string | null;
}

const d = (iso: string | null, intl: string) =>
  iso
    ? new Date(iso).toLocaleDateString(intl, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

export function UsersView({ users, selfId }: { users: U[]; selfId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [target, setTarget] = useState<U | null>(null);
  const [roleChange, setRoleChange] = useState<{ u: U; role: U['role'] } | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { t, intl } = useI18n();
  const us = t.admin.users;
  const roleLabel = (r: U['role']) => t.app.roles[r];

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!n ||
          u.name.toLowerCase().includes(n) ||
          u.email.includes(n) ||
          u.business.toLowerCase().includes(n)) &&
        (role === 'all' || u.role === role),
    );
  }, [users, q, role]);

  function toggle() {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const action = target.status === 'ACTIVE' ? 'suspend' : 'reactivate';
      const res = await setUserStatusAction({
        userId: target.userId,
        action,
        reason: reason || undefined,
      });
      if (!res.ok) return setError(res.error.fieldErrors?.reason ?? res.error.message);
      toast(
        action === 'suspend'
          ? us.toastSuspended({ name: res.data.name })
          : us.toastReactivated({ name: res.data.name }),
      );
      setTarget(null);
      setReason('');
      router.refresh();
    });
  }

  function changeRole() {
    if (!roleChange) return;
    setError(null);
    startTransition(async () => {
      const res = await platformChangeRoleAction({
        membershipId: roleChange.u.membershipId,
        role: roleChange.role,
      });
      if (!res.ok) return setError(res.error.message);
      toast(us.roleUpdated);
      setRoleChange(null);
      router.refresh();
    });
  }

  return (
    <>
      <AdminHeader title={us.title} sub={us.sub({ n: new Set(users.map((u) => u.userId)).size })} />
      <div className={s.content}>
        <div className={tbl.toolbar}>
          <input
            className={tbl.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={us.search}
            aria-label={us.searchLabel}
          />
          <select
            className={tbl.select}
            aria-label={us.role}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="all">{us.allRoles}</option>
            <option value="OWNER">{roleLabel('OWNER')}</option>
            <option value="MANAGER">{roleLabel('MANAGER')}</option>
            <option value="STAFF">{roleLabel('STAFF')}</option>
          </select>
        </div>
        <div className={tbl.wrap} style={{ borderColor: '#e2e2dc' }}>
          <table className={tbl.table} style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>{us.cols.user}</th>
                <th>{us.cols.business}</th>
                <th>{us.cols.role}</th>
                <th>{us.cols.status}</th>
                <th>{us.cols.registered}</th>
                <th>{us.cols.lastActive}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.membershipId}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700 }}>{u.name}</span>
                      <span style={{ fontSize: 12, color: '#62666d' }}>{u.email}</span>
                    </div>
                  </td>
                  <td>{u.business}</td>
                  <td>
                    <select
                      className={tbl.select}
                      aria-label={us.roleFor({ name: u.name })}
                      value={u.role}
                      onChange={(e) => setRoleChange({ u, role: e.target.value as U['role'] })}
                    >
                      <option value="OWNER">{roleLabel('OWNER')}</option>
                      <option value="MANAGER">{roleLabel('MANAGER')}</option>
                      <option value="STAFF">{roleLabel('STAFF')}</option>
                    </select>
                  </td>
                  <td>
                    <StatusPill status={u.status} size="sm" />
                  </td>
                  <td className={tbl.nowrap}>{d(u.registered, intl)}</td>
                  <td className={tbl.nowrap} style={{ color: '#62666d' }}>
                    {d(u.lastActive, intl)}
                  </td>
                  <td className={tbl.right}>
                    {u.userId !== selfId && !u.isAdmin ? (
                      <Button
                        size="sm"
                        variant={u.status === 'ACTIVE' ? 'danger' : 'secondary'}
                        onClick={() => setTarget(u)}
                      >
                        {u.status === 'ACTIVE' ? us.suspend : us.reactivate}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <div className={tbl.empty}>{us.noMatch}</div> : null}
        </div>
      </div>

      <AlertDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={
          target
            ? target.status === 'ACTIVE'
              ? us.suspendTitle({ name: target.name })
              : us.reactivateTitle({ name: target.name })
            : ''
        }
        actions={
          <>
            <Button onClick={() => setTarget(null)}>{us.cancel}</Button>
            <Button
              variant="dangerSolid"
              disabled={pending || (target?.status === 'ACTIVE' && reason.trim().length < 3)}
              onClick={toggle}
            >
              {target?.status === 'ACTIVE' ? us.suspend : us.reactivate}
            </Button>
          </>
        }
      >
        {target?.status === 'ACTIVE' ? <p>{us.suspendBody}</p> : <p>{us.reactivateBody}</p>}
        {target?.status === 'ACTIVE' ? (
          <div style={{ marginTop: 12 }}>
            <Field label={us.reason}>
              {(p) => (
                <Input
                  {...p}
                  value={reason}
                  placeholder={us.required}
                  maxLength={300}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
            </Field>
          </div>
        ) : null}
        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      </AlertDialog>

      <AlertDialog
        open={roleChange !== null}
        onClose={() => setRoleChange(null)}
        title={
          roleChange
            ? us.roleTitle({
                name: roleChange.u.name,
                role: roleLabel(roleChange.role).toLowerCase(),
              })
            : ''
        }
        actions={
          <>
            <Button onClick={() => setRoleChange(null)}>{us.cancel}</Button>
            <Button variant="dangerSolid" disabled={pending} onClick={changeRole}>
              {us.changeRole}
            </Button>
          </>
        }
      >
        <p>{us.roleBody({ business: roleChange?.u.business ?? '' })}</p>
        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      </AlertDialog>
    </>
  );
}
