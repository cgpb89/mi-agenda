'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';
import tbl from '@/components/ui/Table.module.scss';
import { savePlanSettingsAction } from '@/modules/platform/actions';
import { PLAN_LABELS } from '@/modules/platform/constants';
import {
  FEATURE_KEYS,
  MAX_PHOTOS_CEILING,
  type FeatureKey,
  type PlanSettings,
} from '@/modules/plans/features';
import { useI18n } from '@/i18n/client';
import s from './Admin.module.scss';

/** Editable form state: money as major units (strings) so inputs can be empty mid-edit. */
interface Row {
  plan: PlanSettings['plan'];
  crc: string;
  usd: string;
  staff: string;
  photos: string;
  features: FeatureKey[];
}

const toRow = (p: PlanSettings): Row => ({
  plan: p.plan,
  crc: String(p.priceCrcMinor / 100),
  usd: String(p.priceUsdMinor / 100),
  staff: p.staffLimit === null ? '' : String(p.staffLimit),
  photos: String(p.photoLimit),
  features: p.features,
});

const inputStyle = { width: '100%', minWidth: 90 } as const;

export function PlansEditor({ initial }: { initial: PlanSettings[] }) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const pl = t.admin.plans;
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial.map(toRow));

  const set = (plan: Row['plan'], patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.plan === plan ? { ...r, ...patch } : r)));
  const toggle = (plan: Row['plan'], key: FeatureKey) =>
    setRows((rs) =>
      rs.map((r) =>
        r.plan === plan
          ? {
              ...r,
              features: r.features.includes(key)
                ? r.features.filter((f) => f !== key)
                : [...r.features, key],
            }
          : r,
      ),
    );

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await savePlanSettingsAction({
        plans: rows.map((r) => ({
          plan: r.plan,
          priceCrcMinor: Math.round(Number(r.crc || 0) * 100),
          priceUsdMinor: Math.round(Number(r.usd || 0) * 100),
          staffLimit: r.staff.trim() === '' ? null : Number(r.staff),
          photoLimit: Number(r.photos || 0),
          features: r.features,
        })),
      });
      if (!res.ok) return setError(res.error.message);
      toast(pl.saved);
      router.refresh();
    });
  }

  const label = (p: Row['plan']) => t.settings.plans[p] ?? PLAN_LABELS[p];
  const num = (v: string, plan: Row['plan'], field: 'crc' | 'usd' | 'staff' | 'photos') => (
    <input
      type="number"
      min={0}
      step={field === 'crc' ? 100 : field === 'usd' ? 1 : 1}
      max={field === 'photos' ? MAX_PHOTOS_CEILING : undefined}
      className={tbl.select}
      style={inputStyle}
      value={v}
      placeholder={field === 'staff' ? pl.unlimited : undefined}
      aria-label={`${label(plan)} · ${pl[field === 'crc' ? 'priceCrc' : field === 'usd' ? 'priceUsd' : field === 'staff' ? 'staffLimit' : 'photoLimit']}`}
      disabled={field !== 'staff' && field !== 'photos' && plan === 'TRIAL'}
      onChange={(e) => set(plan, { [field]: e.target.value } as Partial<Row>)}
    />
  );

  return (
    <div className={s.card} style={{ gap: 14 }}>
      <div className={tbl.wrap}>
        <table className={tbl.table}>
          <thead>
            <tr>
              <th />
              {rows.map((r) => (
                <th key={r.plan}>{label(r.plan)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{pl.priceCrc}</td>
              {rows.map((r) => (
                <td key={r.plan}>{num(r.crc, r.plan, 'crc')}</td>
              ))}
            </tr>
            <tr>
              <td>{pl.priceUsd}</td>
              {rows.map((r) => (
                <td key={r.plan}>{num(r.usd, r.plan, 'usd')}</td>
              ))}
            </tr>
            <tr>
              <td>
                {pl.staffLimit}
                <div className={s.muted}>{pl.staffHint}</div>
              </td>
              {rows.map((r) => (
                <td key={r.plan}>{num(r.staff, r.plan, 'staff')}</td>
              ))}
            </tr>
            <tr>
              <td>{pl.photoLimit}</td>
              {rows.map((r) => (
                <td key={r.plan}>{num(r.photos, r.plan, 'photos')}</td>
              ))}
            </tr>
            <tr>
              <td colSpan={rows.length + 1} style={{ fontWeight: 700, paddingTop: 18 }}>
                {pl.features}
              </td>
            </tr>
            {FEATURE_KEYS.map((key) => {
              const [name, desc] = pl.featureNames[key] ?? [key, ''];
              return (
                <tr key={key}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{name}</span>
                    <div className={s.muted}>{desc}</div>
                  </td>
                  {rows.map((r) => {
                    const on = r.features.includes(key);
                    return (
                      <td key={r.plan}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${name} · ${label(r.plan)}`}
                          className={[s.switch, on && s.switchOn].filter(Boolean).join(' ')}
                          onClick={() => toggle(r.plan, key)}
                        >
                          <span />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <span className={s.muted}>{pl.trialNote}</span>
      <span className={s.muted}>{pl.downgradeNote}</span>
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      <div>
        <Button loading={pending} variant="primary" disabled={pending || !dirty} onClick={save}>
          {pending ? pl.saving : pl.save}
        </Button>
      </div>
    </div>
  );
}
