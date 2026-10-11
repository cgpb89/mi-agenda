'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Textarea, formStyles } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';
import { savePlatformSettingsAction } from '@/modules/platform/actions';
import { useI18n } from '@/i18n/client';
import s from './Admin.module.scss';

export interface PaymentSettings {
  supportEmail: string;
  supportWhatsapp: string;
  sinpePhone: string;
  sinpeName: string;
  paymentNote: string;
}

/** How businesses pay their plan; shown on owners' billing page. */
export function PaymentSettingsCard({ initial }: { initial: PaymentSettings }) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const pm = t.admin.payment;
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (k: keyof PaymentSettings) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await savePlatformSettingsAction(form);
      if (!res.ok) {
        const fe = res.error.fieldErrors;
        return setError(fe ? Object.values(fe)[0]! : res.error.message);
      }
      toast(pm.saved);
      router.refresh();
    });
  }

  return (
    <div className={s.card} style={{ gap: 12 }}>
      <span className={s.cardTitle}>{pm.title}</span>
      <span className={s.muted}>{pm.sub}</span>
      <div className={formStyles.grid2}>
        <Field label={pm.sinpePhone}>
          {(p) => (
            <Input {...p} maxLength={32} value={form.sinpePhone} onChange={set('sinpePhone')} />
          )}
        </Field>
        <Field label={pm.sinpeName}>
          {(p) => (
            <Input {...p} maxLength={120} value={form.sinpeName} onChange={set('sinpeName')} />
          )}
        </Field>
        <Field label={pm.supportWhatsapp}>
          {(p) => (
            <Input
              {...p}
              maxLength={32}
              placeholder="+506 8888 8888"
              value={form.supportWhatsapp}
              onChange={set('supportWhatsapp')}
            />
          )}
        </Field>
        <Field label={pm.supportEmail}>
          {(p) => (
            <Input
              {...p}
              type="email"
              maxLength={254}
              value={form.supportEmail}
              onChange={set('supportEmail')}
            />
          )}
        </Field>
      </div>
      <Field label={pm.paymentNote} hint={pm.paymentNoteHint}>
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            maxLength={600}
            value={form.paymentNote}
            onChange={set('paymentNote')}
          />
        )}
      </Field>
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      <div>
        <Button variant="primary" disabled={pending || !dirty} onClick={save}>
          {pm.save}
        </Button>
      </div>
    </div>
  );
}
