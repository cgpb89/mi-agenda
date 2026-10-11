'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useToast } from '@/components/ui/Toast';
import { toggleFlagAction } from '@/modules/platform/actions';
import { AdminHeader } from './AdminShell';
import s from './Admin.module.scss';
import { useI18n } from '@/i18n/client';
import type { Messages } from '@/i18n/messages';

function describe(
  a: { action: string; business: string | null; metadata: Record<string, unknown> },
  t: Messages,
): string {
  const m = a.metadata;
  const st = t.admin.settings;
  const plan = (v: unknown) => t.settings.plans[String(v)] ?? String(v);
  const role = (v: unknown) =>
    (t.app.roles as Record<string, string>)[String(v)]?.toLowerCase() ??
    String(v ?? '').toLowerCase();
  const flagName = (v: unknown) =>
    Object.values(st.flagNames).find((f) => f.name === v)?.name ?? String(v);
  const reason = typeof m.reason === 'string' ? st.reason({ reason: m.reason }) : '';
  const name = String(a.business ?? m.name ?? '');
  switch (a.action) {
    case 'tenant.suspended':
      return st.suspended({ name }) + reason;
    case 'tenant.reactivated':
      return st.reactivated({ name }) + reason;
    case 'tenant.plan_changed':
      return st.planChanged({ from: plan(m.from), to: plan(m.to), name }) + reason;
    case 'tenant.created':
      return st.registered({ name: a.business ?? '' });
    case 'user.suspended':
      return st.userSuspended({ name: String(m.name ?? '') }) + reason;
    case 'user.reactivated':
      return st.userReactivated({ name: String(m.name ?? '') });
    case 'feature_flag.toggled':
      return st.flagChanged({ name: flagName(m.name), enabled: Boolean(m.enabled) });
    case 'membership.role_changed':
      return st.roleChanged({
        user: m.user ? String(m.user) : '',
        role: role(m.to),
        business: a.business ?? '',
      });
    case 'platform.admin_granted':
      return st.adminGranted;
    default:
      return a.action;
  }
}

export function PlatformSettingsView({
  flags,
  audit,
  health,
}: {
  flags: { key: string; name: string; note: string; enabled: boolean }[];
  audit: {
    id: string;
    at: string;
    who: string | null;
    action: string;
    business: string | null;
    metadata: Record<string, unknown>;
  }[];
  health: {
    n: keyof Messages['admin']['settings']['healthRows'];
    s: keyof Messages['admin']['settings']['healthValues'];
  }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const { t, intl } = useI18n();
  const st = t.admin.settings;
  const flagText = (f: { key: string; name: string; note: string }) =>
    st.flagNames[f.key] ?? { name: f.name, note: f.note };
  return (
    <>
      <AdminHeader title={st.title} />
      <div className={s.content}>
        <div className={s.grid3} style={{ alignItems: 'start' }}>
          <div className={s.card} style={{ gap: 10 }}>
            <span className={s.cardTitle}>{st.flags}</span>
            {flags.map((f) => (
              <div key={f.key} className={s.flagRow}>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{flagText(f).name}</span>
                  <span className={s.muted}>{flagText(f).note}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={f.enabled}
                  aria-label={flagText(f).name}
                  disabled={pending}
                  className={[s.switch, f.enabled && s.switchOn].filter(Boolean).join(' ')}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await toggleFlagAction({ key: f.key, enabled: !f.enabled });
                      toast(
                        res.ok
                          ? st.flagToggled({ name: flagText(f).name, enabled: !f.enabled })
                          : res.error.message,
                      );
                      router.refresh();
                    })
                  }
                >
                  <span />
                </button>
              </div>
            ))}
            <span className={s.muted}>{st.flagsNote}</span>
          </div>
          <div className={s.card} style={{ gap: 10 }}>
            <span className={s.cardTitle}>{st.health}</span>
            {health.map((h) => (
              <div key={h.n} className={s.healthRow} style={{ fontSize: 13 }}>
                <span>{st.healthRows[h.n]}</span>
                <span style={{ color: '#62666d', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {st.healthValues[h.s]}
                </span>
              </div>
            ))}
            <span className={s.muted}>{st.healthNote}</span>
          </div>
        </div>
        <div className={s.card} style={{ padding: 0, gap: 0 }}>
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid #f0f0ec',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span className={s.cardTitle}>{st.audit}</span>
            <span className={s.muted}>{st.auditNote}</span>
          </div>
          {audit.length === 0 ? (
            <div style={{ padding: 16 }} className={s.muted}>
              {st.noEvents}
            </div>
          ) : null}
          {audit.map((a) => (
            <div key={a.id} className={s.auditRow}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#62666d' }}>
                {new Date(a.at).toLocaleString(intl, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hourCycle: 'h23',
                })}
              </span>
              <span style={{ fontWeight: 600 }}>{a.who ?? t.admin.system}</span>
              <span>{describe(a, t)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
