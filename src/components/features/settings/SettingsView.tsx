'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, FormMessage, Input, Select, Textarea, formStyles } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import t from '@/components/ui/Table.module.scss';
import { CATEGORY_OPTIONS } from '@/components/features/shared/categories';
import { fmtDay, fmtTime } from '@/components/features/shared/format';
import { PHONE_COUNTRIES } from '@/lib/phone/countries';
import { saveBusinessAction, savePolicyAction } from '@/modules/businesses/actions';
import {
  inviteMemberAction,
  revokeInvitationAction,
  updateMemberAction,
} from '@/modules/tenants/actions';

type Role = 'OWNER' | 'MANAGER' | 'STAFF';

const WINDOWS: [number, string][] = [
  [0, 'Any time before the start'],
  [60, '1 hour before'],
  [120, '2 hours before'],
  [240, '4 hours before'],
  [720, '12 hours before'],
  [1440, '24 hours before'],
  [2880, '48 hours before'],
];

const ACTION_LABEL: Record<string, string> = {
  'appointment.created': 'Appointment created',
  'appointment.cancelled': 'Appointment cancelled',
  'appointment.rescheduled': 'Appointment rescheduled',
  'appointment.confirmed': 'Appointment confirmed',
  'appointment.completed': 'Marked completed',
  'appointment.no_show': 'Marked no-show',
  'policy.updated': 'Booking policy changed',
  'payment.recorded': 'Payment recorded',
  'payment.voided': 'Payment voided',
  'membership.invited': 'Team member invited',
  'membership.joined': 'Team member joined',
  'membership.role_changed': 'Role changed',
  'membership.removed': 'Access removed',
  'service.created': 'Service added',
  'service.updated': 'Service edited',
  'service.deactivated': 'Service deactivated',
  'availability.updated': 'Hours updated',
  'booking_page.updated': 'Booking page edited',
  'booking_page.published': 'Booking page status changed',
  'tenant.suspended': 'Business suspended by Tempo',
  'tenant.reactivated': 'Business reactivated by Tempo',
  'tenant.plan_changed': 'Plan changed',
};

export function SettingsView(props: {
  business: {
    name: string;
    country: string;
    category: string;
    currency: string;
    timezone: string;
    plan: string;
    slug: string;
  };
  policy: {
    maxActiveAppointmentsPerPhone: number;
    cancellationWindowMin: number;
    requireEmail: boolean;
    autoConfirm: boolean;
    policyText: string;
    updatedAt: string;
  };
  canPolicy: boolean;
  canRoles: boolean;
  canInvite: boolean;
  currentUserId: string;
  members: {
    id: string;
    role: Role;
    status: 'ACTIVE' | 'SUSPENDED';
    name: string;
    email: string;
    self: boolean;
  }[];
  invites: { id: string; email: string; role: Role; expiresAt: string }[];
  events: { id: string; action: string; actor: string; at: string; target: string }[];
}) {
  const { data } = useShell();
  const slug = data.tenant.slug;
  const tz = data.tenant.timezone;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [biz, setBiz] = useState({
    name: props.business.name,
    country: props.business.country,
    category: props.business.category,
  });
  const [policy, setPolicy] = useState({
    ...props.policy,
    maxActiveAppointmentsPerPhone: String(props.policy.maxActiveAppointmentsPerPhone),
  });
  const [invite, setInvite] = useState({ email: '', role: 'STAFF' as 'STAFF' | 'MANAGER' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function run(
    key: string,
    fn: () => Promise<{
      ok: boolean;
      error?: { message: string; fieldErrors?: Record<string, string> };
    }>,
    success: string,
  ) {
    setErrors((e) => ({ ...e, [key]: '' }));
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        const fe = res.error?.fieldErrors;
        setErrors((e) => ({ ...e, [key]: (fe && Object.values(fe)[0]) || res.error!.message }));
        return;
      }
      toast(success);
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="Business settings"
        sub={`${props.business.name} · ${props.business.plan[0]}${props.business.plan.slice(1).toLowerCase()} plan`}
      />
      <PageContent>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <Card title="Booking policy">
            {errors.policy ? <FormMessage kind="error">{errors.policy}</FormMessage> : null}
            <Field label="Active appointments per phone number" hint="1–20">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  disabled={!props.canPolicy}
                  value={policy.maxActiveAppointmentsPerPhone}
                  onChange={(e) =>
                    setPolicy({ ...policy, maxActiveAppointmentsPerPhone: e.target.value })
                  }
                />
              )}
            </Field>
            <span style={{ fontSize: 12, color: '#6b6358', lineHeight: 1.5 }}>
              How many upcoming pending or confirmed appointments one phone number can hold with
              your business at the same time. Past, cancelled, completed and no-show appointments
              don&rsquo;t count. Phone numbers are not verified, so this is an anti-spam limit, not
              identity proof. It also applies to appointments your team creates.
            </span>
            <Field label="Customers can cancel or reschedule online until">
              {(p) => (
                <Select
                  {...p}
                  disabled={!props.canPolicy}
                  value={policy.cancellationWindowMin}
                  onChange={(e) =>
                    setPolicy({ ...policy, cancellationWindowMin: Number(e.target.value) })
                  }
                >
                  {WINDOWS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <label className={formStyles.checkbox}>
              <input
                type="checkbox"
                disabled={!props.canPolicy}
                checked={policy.requireEmail}
                onChange={(e) => setPolicy({ ...policy, requireEmail: e.target.checked })}
              />
              Ask customers for an email address
            </label>
            <label className={formStyles.checkbox}>
              <input
                type="checkbox"
                disabled={!props.canPolicy}
                checked={policy.autoConfirm}
                onChange={(e) => setPolicy({ ...policy, autoConfirm: e.target.checked })}
              />
              Confirm online bookings automatically (otherwise they arrive as Pending)
            </label>
            <Field label="Policy shown before booking" hint="Optional">
              {(p) => (
                <Textarea
                  {...p}
                  rows={3}
                  maxLength={600}
                  disabled={!props.canPolicy}
                  placeholder="Free cancellation up to 4 hours before. Late arrivals over 15 minutes may need to rebook."
                  value={policy.policyText}
                  onChange={(e) => setPolicy({ ...policy, policyText: e.target.value })}
                />
              )}
            </Field>
            {props.canPolicy ? (
              <div>
                <Button
                  variant="primary"
                  disabled={pending}
                  onClick={() =>
                    run(
                      'policy',
                      () =>
                        savePolicyAction(slug, {
                          maxActiveAppointmentsPerPhone: policy.maxActiveAppointmentsPerPhone,
                          cancellationWindowMin: policy.cancellationWindowMin,
                          requireEmail: policy.requireEmail,
                          autoConfirm: policy.autoConfirm,
                          policyText: policy.policyText,
                        }),
                      'Booking policy saved',
                    )
                  }
                >
                  Save policy
                </Button>
              </div>
            ) : null}
          </Card>

          <Card title="Business">
            {errors.biz ? <FormMessage kind="error">{errors.biz}</FormMessage> : null}
            <Field label="Business name">
              {(p) => (
                <Input
                  {...p}
                  value={biz.name}
                  maxLength={120}
                  onChange={(e) => setBiz({ ...biz, name: e.target.value })}
                />
              )}
            </Field>
            <div className={formStyles.grid2}>
              <Field label="Type of business">
                {(p) => (
                  <Select
                    {...p}
                    value={biz.category}
                    onChange={(e) => setBiz({ ...biz, category: e.target.value })}
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Country" hint="Default for phone numbers">
                {(p) => (
                  <Select
                    {...p}
                    value={biz.country}
                    onChange={(e) => setBiz({ ...biz, country: e.target.value })}
                  >
                    {PHONE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <span style={{ fontSize: 12, color: '#6b6358' }}>
              Booking address /book/{props.business.slug} · Currency {props.business.currency} ·
              Time zone {props.business.timezone} (change it in Availability).
            </span>
            <div>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() =>
                  run('biz', () => saveBusinessAction(slug, biz), 'Business details saved')
                }
              >
                Save business
              </Button>
            </div>
          </Card>
        </div>

        <section id="team">
          <Card title="Team access" flush>
            <div className={t.wrap} style={{ border: 0 }}>
              <table className={t.table} style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {props.members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>
                            {m.name}
                            {m.self ? ' (you)' : ''}
                          </span>
                          <span className={t.faint}>{m.email}</span>
                        </div>
                      </td>
                      <td>
                        {props.canRoles && !m.self ? (
                          <select
                            className={t.select}
                            aria-label={`Role for ${m.name}`}
                            value={m.role}
                            disabled={pending}
                            onChange={(e) =>
                              run(
                                'team',
                                () =>
                                  updateMemberAction(slug, {
                                    membershipId: m.id,
                                    role: e.target.value,
                                  }),
                                'Role updated',
                              )
                            }
                          >
                            <option value="OWNER">Owner</option>
                            <option value="MANAGER">Manager</option>
                            <option value="STAFF">Staff</option>
                          </select>
                        ) : (
                          m.role[0] + m.role.slice(1).toLowerCase()
                        )}
                      </td>
                      <td>
                        <StatusPill status={m.status} size="sm" />
                      </td>
                      <td className={t.right}>
                        {props.canRoles && !m.self ? (
                          <Button
                            size="sm"
                            variant={m.status === 'ACTIVE' ? 'danger' : 'secondary'}
                            disabled={pending}
                            onClick={() =>
                              run(
                                'team',
                                () =>
                                  updateMemberAction(slug, {
                                    membershipId: m.id,
                                    status: m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                                  }),
                                m.status === 'ACTIVE'
                                  ? `${m.name} can no longer sign in here`
                                  : `${m.name} reactivated`,
                              )
                            }
                          >
                            {m.status === 'ACTIVE' ? 'Remove access' : 'Restore access'}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {props.invites.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{i.email}</span>{' '}
                        <span className={t.faint}>
                          · invited, expires {fmtDay(i.expiresAt, tz)}
                        </span>
                      </td>
                      <td>{i.role[0] + i.role.slice(1).toLowerCase()}</td>
                      <td>
                        <StatusPill status="TRIAL" size="sm" label="Pending" />
                      </td>
                      <td className={t.right}>
                        {props.canInvite ? (
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              run(
                                'team',
                                () => revokeInvitationAction(slug, i.id),
                                'Invitation revoked',
                              )
                            }
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                borderTop: '1px solid #efebe4',
              }}
            >
              {errors.team ? <FormMessage kind="error">{errors.team}</FormMessage> : null}
              {props.canInvite ? (
                <div className={t.toolbar}>
                  <input
                    className={t.search}
                    type="email"
                    placeholder="Email address"
                    aria-label="Invite email"
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  />
                  <select
                    className={t.select}
                    aria-label="Invite role"
                    value={invite.role}
                    onChange={(e) =>
                      setInvite({ ...invite, role: e.target.value as 'STAFF' | 'MANAGER' })
                    }
                  >
                    <option value="STAFF">Staff · own calendar</option>
                    {props.canRoles ? (
                      <option value="MANAGER">Manager · everything except roles</option>
                    ) : null}
                  </select>
                  <Button
                    variant="primary"
                    disabled={pending || !invite.email.trim()}
                    onClick={() => {
                      setErrors((e) => ({ ...e, team: '' }));
                      startTransition(async () => {
                        const res = await inviteMemberAction(slug, invite);
                        if (!res.ok)
                          return setErrors((e) => ({
                            ...e,
                            team: res.error.fieldErrors?.email ?? res.error.message,
                          }));
                        toast(
                          res.data.emailed
                            ? 'Invitation sent'
                            : 'Invitation created — email isn’t set up, so share the link from the server log (development only)',
                        );
                        setInvite({ ...invite, email: '' });
                        router.refresh();
                      });
                    }}
                  >
                    Send invitation
                  </Button>
                </div>
              ) : null}
              <span style={{ fontSize: 12, color: '#6b6358' }}>
                Staff see the calendar and appointments and manage only their own bookings. Managers
                can change services, hours, policies and the booking page. Changing someone&rsquo;s
                role signs them out everywhere.
              </span>
            </div>
          </Card>
        </section>

        {props.events.length ? (
          <Card title="Recent activity" flush>
            <div className={t.wrap} style={{ border: 0 }}>
              <table className={t.table}>
                <tbody>
                  {props.events.map((e) => (
                    <tr key={e.id}>
                      <td className={t.mono} style={{ width: 150 }}>
                        {fmtDay(e.at, tz, { month: 'short', day: 'numeric' })}, {fmtTime(e.at, tz)}
                      </td>
                      <td style={{ width: 160, fontWeight: 700 }}>{e.actor}</td>
                      <td>{ACTION_LABEL[e.action] ?? e.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </PageContent>
    </>
  );
}
