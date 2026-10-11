'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, FormMessage, Input, Select, Textarea, formStyles } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import tbl from '@/components/ui/Table.module.scss';
import { CATEGORY_VALUES } from '@/components/features/shared/categories';
import { fmtDay, fmtTime } from '@/components/features/shared/format';
import { PHONE_COUNTRIES } from '@/lib/phone/countries';
import { saveBusinessAction, savePolicyAction } from '@/modules/businesses/actions';
import {
  inviteMemberAction,
  revokeInvitationAction,
  updateMemberAction,
} from '@/modules/tenants/actions';
import { useI18n } from '@/i18n/client';
import { countryName } from '@/i18n/format';

type Role = 'OWNER' | 'MANAGER' | 'STAFF';

const WINDOWS = [0, 60, 120, 240, 720, 1440, 2880];

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
  const { t, locale } = useI18n();
  const se = t.settings;

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
        title={t.app.nav.settings}
        sub={se.sub({
          business: props.business.name,
          plan: se.plans[props.business.plan] ?? props.business.plan,
        })}
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
          <Card title={se.policy}>
            {errors.policy ? <FormMessage kind="error">{errors.policy}</FormMessage> : null}
            <Field label={se.perPhone} hint={se.perPhoneHint}>
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
              {se.perPhoneHelp}
            </span>
            <Field label={se.window}>
              {(p) => (
                <Select
                  {...p}
                  disabled={!props.canPolicy}
                  value={policy.cancellationWindowMin}
                  onChange={(e) =>
                    setPolicy({ ...policy, cancellationWindowMin: Number(e.target.value) })
                  }
                >
                  {WINDOWS.map((v) => (
                    <option key={v} value={v}>
                      {se.windows[v]}
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
              {se.requireEmail}
            </label>
            <label className={formStyles.checkbox}>
              <input
                type="checkbox"
                disabled={!props.canPolicy}
                checked={policy.autoConfirm}
                onChange={(e) => setPolicy({ ...policy, autoConfirm: e.target.checked })}
              />
              {se.autoConfirm}
            </label>
            <Field label={se.policyText} hint={se.optional}>
              {(p) => (
                <Textarea
                  {...p}
                  rows={3}
                  maxLength={600}
                  disabled={!props.canPolicy}
                  placeholder={se.policyPlaceholder}
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
                      se.policySaved,
                    )
                  }
                >
                  {se.savePolicy}
                </Button>
              </div>
            ) : null}
          </Card>

          <Card title={se.business}>
            {errors.biz ? <FormMessage kind="error">{errors.biz}</FormMessage> : null}
            <Field label={se.businessName}>
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
              <Field label={se.category}>
                {(p) => (
                  <Select
                    {...p}
                    value={biz.category}
                    onChange={(e) => setBiz({ ...biz, category: e.target.value })}
                  >
                    {CATEGORY_VALUES.map((c) => (
                      <option key={c} value={c}>
                        {t.common.categories[c]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={se.country} hint={se.countryHint}>
                {(p) => (
                  <Select
                    {...p}
                    value={biz.country}
                    onChange={(e) => setBiz({ ...biz, country: e.target.value })}
                  >
                    {PHONE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {countryName(c.code, locale, c.name)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <span style={{ fontSize: 12, color: '#6b6358' }}>
              {se.businessFacts({
                slug: props.business.slug,
                currency: props.business.currency,
                timezone: props.business.timezone,
              })}
            </span>
            <div>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => run('biz', () => saveBusinessAction(slug, biz), se.businessSaved)}
              >
                {se.saveBusiness}
              </Button>
            </div>
          </Card>
        </div>

        <section id="team">
          <Card title={se.team} flush>
            <div className={tbl.wrap} style={{ border: 0 }}>
              <table className={tbl.table} style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>{se.person}</th>
                    <th>{se.role}</th>
                    <th>{se.status}</th>
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
                            {m.self ? se.you : ''}
                          </span>
                          <span className={tbl.faint}>{m.email}</span>
                        </div>
                      </td>
                      <td>
                        {props.canRoles && !m.self ? (
                          <select
                            className={tbl.select}
                            aria-label={se.roleFor({ name: m.name })}
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
                                se.roleUpdated,
                              )
                            }
                          >
                            <option value="OWNER">{t.app.roles.OWNER}</option>
                            <option value="MANAGER">{t.app.roles.MANAGER}</option>
                            <option value="STAFF">{t.app.roles.STAFF}</option>
                          </select>
                        ) : (
                          t.app.roles[m.role]
                        )}
                      </td>
                      <td>
                        <StatusPill status={m.status} size="sm" />
                      </td>
                      <td className={tbl.right}>
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
                                  ? se.accessRemoved({ name: m.name })
                                  : se.reactivated({ name: m.name }),
                              )
                            }
                          >
                            {m.status === 'ACTIVE' ? se.removeAccess : se.restoreAccess}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {props.invites.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{i.email}</span>{' '}
                        <span className={tbl.faint}>
                          {se.invitedExpires({ date: fmtDay(i.expiresAt, tz, locale) })}
                        </span>
                      </td>
                      <td>{t.app.roles[i.role]}</td>
                      <td>
                        <StatusPill status="TRIAL" size="sm" label={se.pending} />
                      </td>
                      <td className={tbl.right}>
                        {props.canInvite ? (
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              run('team', () => revokeInvitationAction(slug, i.id), se.revoked)
                            }
                          >
                            {se.revoke}
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
                <div className={tbl.toolbar}>
                  <input
                    className={tbl.search}
                    type="email"
                    placeholder={se.emailPlaceholder}
                    aria-label={se.inviteEmail}
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  />
                  <select
                    className={tbl.select}
                    aria-label={se.inviteRole}
                    value={invite.role}
                    onChange={(e) =>
                      setInvite({ ...invite, role: e.target.value as 'STAFF' | 'MANAGER' })
                    }
                  >
                    <option value="STAFF">{se.staffOption}</option>
                    {props.canRoles ? <option value="MANAGER">{se.managerOption}</option> : null}
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
                        toast(res.data.emailed ? se.invitationSent : se.invitationCreated);
                        setInvite({ ...invite, email: '' });
                        router.refresh();
                      });
                    }}
                  >
                    {se.sendInvitation}
                  </Button>
                </div>
              ) : null}
              <span style={{ fontSize: 12, color: '#6b6358' }}>{se.rolesHelp}</span>
            </div>
          </Card>
        </section>

        {props.events.length ? (
          <Card title={se.activity} flush>
            <div className={tbl.wrap} style={{ border: 0 }}>
              <table className={tbl.table}>
                <tbody>
                  {props.events.map((e) => (
                    <tr key={e.id}>
                      <td className={tbl.mono} style={{ width: 150 }}>
                        {fmtDay(e.at, tz, locale, { month: 'short', day: 'numeric' })},{' '}
                        {fmtTime(e.at, tz, locale)}
                      </td>
                      <td style={{ width: 160, fontWeight: 700 }}>{e.actor}</td>
                      <td>{se.actions[e.action] ?? e.action}</td>
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
