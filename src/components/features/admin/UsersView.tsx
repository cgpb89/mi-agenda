'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertDialog } from '@/components/ui/Dialog';
import { Field, FormMessage, Input } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import t from '@/components/ui/Table.module.scss';
import { platformChangeRoleAction, setUserStatusAction } from '@/modules/platform/actions';
import { AdminHeader } from './AdminShell';
import s from './Admin.module.scss';

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

const d = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
      toast(`${res.data.name} ${action === 'suspend' ? 'suspended' : 'reactivated'}`);
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
      toast('Role updated');
      setRoleChange(null);
      router.refresh();
    });
  }

  return (
    <>
      <AdminHeader title="Users" sub={`${new Set(users.map((u) => u.userId)).size} users`} />
      <div className={s.content}>
        <div className={t.toolbar}>
          <input
            className={t.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email or business"
            aria-label="Search users"
          />
          <select
            className={t.select}
            aria-label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="all">All roles</option>
            <option value="OWNER">Owner</option>
            <option value="MANAGER">Manager</option>
            <option value="STAFF">Staff</option>
          </select>
        </div>
        <div className={t.wrap} style={{ borderColor: '#e2e2dc' }}>
          <table className={t.table} style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Business</th>
                <th>Role</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Last active</th>
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
                      className={t.select}
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      onChange={(e) => setRoleChange({ u, role: e.target.value as U['role'] })}
                    >
                      <option value="OWNER">Owner</option>
                      <option value="MANAGER">Manager</option>
                      <option value="STAFF">Staff</option>
                    </select>
                  </td>
                  <td>
                    <StatusPill status={u.status} size="sm" />
                  </td>
                  <td className={t.nowrap}>{d(u.registered)}</td>
                  <td className={t.nowrap} style={{ color: '#62666d' }}>
                    {d(u.lastActive)}
                  </td>
                  <td className={t.right}>
                    {u.userId !== selfId && !u.isAdmin ? (
                      <Button
                        size="sm"
                        variant={u.status === 'ACTIVE' ? 'danger' : 'secondary'}
                        onClick={() => setTarget(u)}
                      >
                        {u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <div className={t.empty}>No users match.</div> : null}
        </div>
      </div>

      <AlertDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={
          target ? `${target.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'} ${target.name}?` : ''
        }
        actions={
          <>
            <Button onClick={() => setTarget(null)}>Cancel</Button>
            <Button
              variant="dangerSolid"
              disabled={pending || (target?.status === 'ACTIVE' && reason.trim().length < 3)}
              onClick={toggle}
            >
              {target?.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
            </Button>
          </>
        }
      >
        {target?.status === 'ACTIVE' ? (
          <p>They will be signed out of every business immediately.</p>
        ) : (
          <p>They can sign in again.</p>
        )}
        {target?.status === 'ACTIVE' ? (
          <div style={{ marginTop: 12 }}>
            <Field label="Reason, saved to the audit log">
              {(p) => (
                <Input
                  {...p}
                  value={reason}
                  placeholder="Required"
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
        title={roleChange ? `Change ${roleChange.u.name} to ${roleChange.role.toLowerCase()}?` : ''}
        actions={
          <>
            <Button onClick={() => setRoleChange(null)}>Cancel</Button>
            <Button variant="dangerSolid" disabled={pending} onClick={changeRole}>
              Change role
            </Button>
          </>
        }
      >
        <p>
          This changes their access in {roleChange?.u.business} and signs them out. Use for support
          requests such as ownership transfers.
        </p>
        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      </AlertDialog>
    </>
  );
}
