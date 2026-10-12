'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage, Input } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';
import { UpgradeCard } from '@/components/features/plans/UpgradeCard';
import { HEX_COLOR, contrastRatio } from '@/lib/color';
import {
  prepareLogoUploadAction,
  removeLogoAction,
  setLogoAction,
} from '@/modules/businesses/logo-actions';
import type { PlanKey } from '@/modules/plans/features';
import { useI18n } from '@/i18n/client';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp';
/** Buttons and highlights need at least 3:1 against the page (WCAG non-text contrast). */
const MIN_CONTRAST = 3;

/**
 * Brand color (part of the page form, saved with "Save changes") and logo
 * (saved immediately, like photos). Plan feature `brandColors`.
 */
export function BrandCard({
  locked,
  accent,
  onAccent,
  templateAccent,
  templateBg,
  logo,
  uploadsEnabled,
}: {
  /** Set when the plan lacks brand colors: shows an upgrade prompt instead. */
  locked: { plan: PlanKey | null } | null;
  accent: string | undefined;
  onAccent: (value: string | undefined) => void;
  templateAccent: string;
  templateBg: string;
  logo: { src: string } | null;
  uploadsEnabled: boolean;
}) {
  const { data } = useShell();
  const slug = data.tenant.slug;
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const bp = t.bookingPage;
  const fileInput = useRef<HTMLInputElement>(null);
  const [hex, setHex] = useState(accent ?? '');
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (locked) {
    return (
      <Card title={bp.brand} tourId="bp-brand">
        <UpgradeCard plan={locked.plan} body={bp.brandBody} />
      </Card>
    );
  }

  const shown = accent ?? templateAccent;
  const lowContrast = contrastRatio(shown, templateBg) < MIN_CONTRAST;

  function pick(value: string) {
    setHex(value);
    if (HEX_COLOR.test(value)) onAccent(value.toLowerCase());
  }

  async function upload(file: File) {
    setError(null);
    if (!ACCEPT.split(',').includes(file.type)) return setError(bp.photoWrongType);
    if (file.size > MAX_BYTES) return setError(bp.photoTooLarge);
    setBusy(true);
    try {
      const signed = await prepareLogoUploadAction(slug);
      if (!signed.ok) return setError(signed.error.message);
      const body = new FormData();
      for (const [k, v] of Object.entries(signed.data!.fields)) body.append(k, v);
      body.append('file', file);
      const res = await fetch(signed.data!.url, { method: 'POST', body }).catch(() => null);
      if (!res?.ok) return setError(bp.photoUploadFailed);
      const saved = await setLogoAction(slug, { publicId: signed.data!.fields.public_id });
      if (!saved.ok) return setError(saved.error.message);
      toast(bp.toastLogoSaved);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await removeLogoAction(slug);
      if (!res.ok) return setError(res.error.message);
      toast(bp.toastLogoRemoved);
      router.refresh();
    });
  }

  return (
    <Card title={bp.brand} tourId="bp-brand">
      <span style={{ fontSize: 13, color: '#5d564b' }}>{bp.brandBody}</span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#5d564b' }}>{bp.accent}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="color"
            aria-label={bp.accent}
            value={shown}
            onChange={(e) => pick(e.target.value)}
            style={{ width: 44, height: 36, padding: 0, border: 0, background: 'none' }}
          />
          <Input
            aria-label={`${bp.accent} (hex)`}
            value={hex}
            placeholder={templateAccent}
            maxLength={7}
            style={{ width: 110, fontFamily: 'var(--font-mono), monospace' }}
            onChange={(e) => pick(e.target.value.trim())}
          />
          {accent ? (
            <Button
              size="sm"
              onClick={() => {
                setHex('');
                onAccent(undefined);
              }}
            >
              {bp.accentReset}
            </Button>
          ) : null}
          <span style={{ fontSize: 12, color: '#6b6358' }}>{bp.accentHint}</span>
        </div>
        {lowContrast ? <FormMessage kind="warning">{bp.accentLowContrast}</FormMessage> : null}
      </div>

      {uploadsEnabled ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#5d564b' }}>{bp.logo}</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {logo ? (
              <span
                style={{
                  background: templateBg,
                  borderRadius: 8,
                  padding: '8px 12px',
                  display: 'inline-flex',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.src} alt="" style={{ height: 36, width: 'auto' }} />
              </span>
            ) : null}
            <Button
              size="sm"
              variant="primary"
              disabled={busy || pending}
              onClick={() => fileInput.current?.click()}
            >
              {busy ? bp.uploading : logo ? bp.replaceLogo : bp.uploadLogo}
            </Button>
            {logo ? (
              <Button size="sm" variant="danger" disabled={busy || pending} onClick={remove}>
                {bp.removeLogo}
              </Button>
            ) : null}
          </div>
          <span style={{ fontSize: 12, color: '#6b6358' }}>{bp.logoHint}</span>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void upload(file);
            }}
          />
        </div>
      ) : null}
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
    </Card>
  );
}
