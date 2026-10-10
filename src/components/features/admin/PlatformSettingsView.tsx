'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useToast } from '@/components/ui/Toast';
import { toggleFlagAction } from '@/modules/platform/actions';
import { AdminHeader } from './AdminShell';
import s from './Admin.module.scss';

const PLAN = {
  TRIAL: 'Trial',
  STARTER: 'Starter',
  GROWTH: 'Growth',
  BUSINESS: 'Business',
} as Record<string, string>;

function describe(a: {
  action: string;
  business: string | null;
  metadata: Record<string, unknown>;
}): string {
  const m = a.metadata;
  const reason = typeof m.reason === 'string' ? ` · reason: ${m.reason}` : '';
  switch (a.action) {
    case 'tenant.suspended':
      return `Suspended ${a.business ?? m.name}${reason}`;
    case 'tenant.reactivated':
      return `Reactivated ${a.business ?? m.name}${reason}`;
    case 'tenant.plan_changed':
      return `Changed plan ${PLAN[String(m.from)] ?? m.from} → ${PLAN[String(m.to)] ?? m.to} · ${a.business ?? m.name}${reason}`;
    case 'tenant.created':
      return `New business registered · ${a.business}`;
    case 'user.suspended':
      return `Suspended user ${m.name ?? ''}${reason}`;
    case 'user.reactivated':
      return `Reactivated user ${m.name ?? ''}`;
    case 'feature_flag.toggled':
      return `${m.enabled ? 'Enabled' : 'Disabled'} feature flag “${m.name}”`;
    case 'membership.role_changed':
      return `Changed role${m.user ? ` of ${m.user}` : ''} to ${String(m.to ?? '').toLowerCase()}${a.business ? ` · ${a.business}` : ''}`;
    case 'platform.admin_granted':
      return 'Granted platform admin';
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
    who: string;
    action: string;
    business: string | null;
    metadata: Record<string, unknown>;
  }[];
  health: { n: string; s: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <AdminHeader title="Settings & audit log" />
      <div className={s.content}>
        <div className={s.grid3} style={{ alignItems: 'start' }}>
          <div className={s.card} style={{ gap: 10 }}>
            <span className={s.cardTitle}>Feature flags</span>
            {flags.map((f) => (
              <div key={f.key} className={s.flagRow}>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{f.name}</span>
                  <span className={s.muted}>{f.note}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={f.enabled}
                  aria-label={f.name}
                  disabled={pending}
                  className={[s.switch, f.enabled && s.switchOn].filter(Boolean).join(' ')}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await toggleFlagAction({ key: f.key, enabled: !f.enabled });
                      toast(
                        res.ok
                          ? `${f.name} ${f.enabled ? 'disabled' : 'enabled'}`
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
            <span className={s.muted}>
              Flags are recorded for upcoming features; none gate shipped behaviour yet.
            </span>
          </div>
          <div className={s.card} style={{ gap: 10 }}>
            <span className={s.cardTitle}>System health</span>
            {health.map((h) => (
              <div key={h.n} className={s.healthRow} style={{ fontSize: 13 }}>
                <span>{h.n}</span>
                <span style={{ color: '#62666d', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {h.s}
                </span>
              </div>
            ))}
            <span className={s.muted}>
              Live checks from this server. Uptime and error monitoring are not connected.
            </span>
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
            <span className={s.cardTitle}>Audit log</span>
            <span className={s.muted}>Every account-affecting action is recorded</span>
          </div>
          {audit.length === 0 ? (
            <div style={{ padding: 16 }} className={s.muted}>
              No events yet.
            </div>
          ) : null}
          {audit.map((a) => (
            <div key={a.id} className={s.auditRow}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#62666d' }}>
                {new Date(a.at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hourCycle: 'h23',
                })}
              </span>
              <span style={{ fontWeight: 600 }}>{a.who}</span>
              <span>{describe(a)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
