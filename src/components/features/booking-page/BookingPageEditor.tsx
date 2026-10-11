'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, FormMessage, Input, Select, Textarea, formStyles } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { saveBookingPageAction, setPageStatusAction } from '@/modules/businesses/actions';
import { PhotoManager, type EditorPhoto } from './PhotoManager';
import { BrandCard } from './BrandCard';
import type { PlanKey } from '@/modules/plans/features';
import { GLASS_TEMPLATES, type PageContent as Content } from '@/modules/businesses/page-content';
import { useI18n } from '@/i18n/client';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/i18n/config';

type Template = 'BARBER' | 'WELLNESS' | 'CONSULT' | 'FITNESS' | 'SERVICES';

// Swatches from the design system's "Template identities".
const TEMPLATES: {
  key: Template;
  sample: string;
  bg: string;
  ink: string;
  accent: string;
  font: string;
  style?: React.CSSProperties;
}[] = [
  {
    key: 'BARBER',
    sample: 'NORTHSIDE',
    bg: '#16120f',
    ink: '#f3ece2',
    accent: '#d6a15c',
    font: 'var(--font-anton), sans-serif',
  },
  {
    key: 'WELLNESS',
    sample: 'Sable & Sage',
    bg: '#f4efe6',
    ink: '#3a3128',
    accent: '#7f6545',
    font: 'var(--font-cormorant), serif',
    style: { fontStyle: 'italic', fontWeight: 500 },
  },
  {
    key: 'CONSULT',
    sample: 'Harbor Physio',
    bg: '#fff',
    ink: '#14233a',
    accent: '#1f5fbf',
    font: 'var(--font-public-sans), sans-serif',
    style: { fontWeight: 700 },
  },
  {
    key: 'FITNESS',
    sample: 'FORGE/LAB',
    bg: '#0e0f0c',
    ink: '#f2f5ea',
    accent: '#c8f542',
    font: 'var(--font-archivo), sans-serif',
    style: { fontWeight: 900, fontStyle: 'italic', fontStretch: '62%' },
  },
  {
    key: 'SERVICES',
    sample: 'Mendwell',
    bg: '#efefec',
    ink: '#1d1f22',
    accent: '#d9532a',
    font: 'var(--font-schibsted), sans-serif',
    style: { fontWeight: 800 },
  },
];

interface Form {
  displayName: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  hoursNote: string;
  template: Template;
  content: Content;
  locale: Locale;
}

export function BookingPageEditor({
  initial,
  pageStatus,
  ready,
  photos,
  uploadsEnabled,
  photoLimit,
  brand,
  glassLockedPlan,
}: {
  initial: Form;
  pageStatus: string;
  ready: { services: boolean; hours: boolean };
  photos: EditorPhoto[];
  uploadsEnabled: boolean;
  photoLimit: number;
  /** Brand color + logo; `locked` set when the plan lacks `brandColors`. */
  brand: { locked: { plan: PlanKey | null } | null; logo: { src: string } | null };
  /** Undefined when the plan includes glass; otherwise the plan that unlocks it. */
  glassLockedPlan?: PlanKey | null;
}) {
  const { data } = useShell();
  const slug = data.tenant.slug;
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();
  const bp = t.bookingPage;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const c = form.content;
  const setC = (patch: Partial<Content>) =>
    setForm({ ...form, content: { ...form.content, ...patch } });
  const highlights = [0, 1, 2].map((i) => c.highlights?.[i] ?? { title: '', body: '' });

  function save() {
    setError(null);
    startTransition(async () => {
      const content: Content = {
        ...c,
        highlights: highlights.filter((h) => h.title.trim()),
        notes: (c.notes ?? []).map((n) => n.trim()).filter(Boolean),
      };
      for (const k of ['headline', 'intro', 'eyebrow', 'ctaLabel', 'notesTitle'] as const)
        if (!content[k]?.trim()) delete content[k];
      const res = await saveBookingPageAction(slug, { ...form, content });
      if (!res.ok)
        return setError(
          res.error.fieldErrors
            ? `${res.error.message} (${Object.keys(res.error.fieldErrors).join(', ')})`
            : res.error.message,
        );
      toast(bp.toastSaved);
      router.refresh();
    });
  }

  function setStatus(status: 'PUBLISHED' | 'UNPUBLISHED') {
    setError(null);
    startTransition(async () => {
      const res = await setPageStatusAction(slug, { status });
      if (!res.ok) return setError(res.error.message);
      toast(status === 'PUBLISHED' ? bp.toastPublished : bp.toastUnpublished);
      router.refresh();
    });
  }

  const published = pageStatus === 'PUBLISHED';
  const currentTemplate = TEMPLATES.find((tp) => tp.key === form.template) ?? TEMPLATES[0]!;

  return (
    <>
      <PageHeader title={t.app.nav['booking-page']} sub={`/book/${slug}`} hideNew>
        <a
          href={`/book/${slug}${published ? '' : '?preview=1'}`}
          target="_blank"
          rel="noopener"
          style={{ fontWeight: 600, fontSize: 13, color: '#c4581f' }}
        >
          {published ? bp.viewLive : bp.preview}
        </a>
      </PageHeader>
      <PageContent>
        <Card
          title={bp.status}
          action={
            <StatusPill
              status={published ? 'ACTIVE' : 'INACTIVE'}
              label={
                published ? bp.published : pageStatus === 'UNPUBLISHED' ? bp.unpublished : bp.draft
              }
            />
          }
        >
          <span style={{ color: '#5d564b' }}>{published ? bp.liveNote : bp.draftNote}</span>
          {!published && (!ready.services || !ready.hours) ? (
            <FormMessage kind="warning">
              {bp.beforePublishing}{' '}
              {[!ready.services && bp.addOnlineService, !ready.hours && bp.setHours]
                .filter(Boolean)
                .join(bp.and)}
              .
            </FormMessage>
          ) : null}
          <div>
            {published ? (
              <Button variant="danger" disabled={pending} onClick={() => setStatus('UNPUBLISHED')}>
                {bp.unpublish}
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={pending || dirty}
                onClick={() => setStatus('PUBLISHED')}
              >
                {bp.publish}
              </Button>
            )}
          </div>
        </Card>

        <Card title={bp.template}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 8,
            }}
          >
            {TEMPLATES.map((tp) => {
              const on = form.template === tp.key;
              return (
                <button
                  key={tp.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setForm({ ...form, template: tp.key })}
                  style={{
                    appearance: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: tp.bg,
                    color: tp.ink,
                    border: `2px solid ${on ? tp.accent : '#e3ddd2'}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    outline: on ? `2px solid ${tp.accent}` : undefined,
                  }}
                >
                  <span style={{ fontFamily: tp.font, fontSize: 22, ...tp.style }}>
                    {tp.sample}
                  </span>
                  <span style={{ fontSize: 12, color: tp.accent, fontWeight: 600 }}>
                    {bp.templates[tp.key]}
                  </span>
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 12, color: '#6b6358' }}>{bp.templateNote}</span>
          {GLASS_TEMPLATES.includes(form.template) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch
                checked={glassLockedPlan === undefined && c.style === 'glass'}
                disabled={glassLockedPlan !== undefined}
                labelledBy="glass-style-label"
                // Off is stored as "no style" so toggling back doesn't count as an edit.
                onChange={(on) => setC({ style: on ? 'glass' : undefined })}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span id="glass-style-label" style={{ fontWeight: 600 }}>
                  {bp.glassStyle}
                </span>
                <span style={{ fontSize: 12, color: '#6b6358' }}>
                  {glassLockedPlan !== undefined
                    ? bp.glassLocked({
                        plan: glassLockedPlan
                          ? (t.settings.plans[glassLockedPlan] ?? glassLockedPlan)
                          : '—',
                      })
                    : bp.glassHint}
                </span>
              </span>
            </div>
          ) : null}
        </Card>

        <BrandCard
          locked={brand.locked}
          accent={c.accent}
          onAccent={(accent) => setC({ accent })}
          templateAccent={currentTemplate.accent}
          templateBg={currentTemplate.bg}
          logo={brand.logo}
          uploadsEnabled={uploadsEnabled}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <Card title={bp.details}>
            <div className={formStyles.grid2}>
              <Field label={bp.nameOnPage}>
                {(p) => (
                  <Input
                    {...p}
                    maxLength={120}
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  />
                )}
              </Field>
              <Field label={bp.language} hint={bp.languageHint}>
                {(p) => (
                  <Select
                    {...p}
                    value={form.locale}
                    onChange={(e) => setForm({ ...form, locale: e.target.value as Locale })}
                  >
                    {LOCALES.map((l) => (
                      <option key={l} value={l}>
                        {LOCALE_NAMES[l]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field label={bp.tagline} hint={bp.optional}>
              {(p) => (
                <Input
                  {...p}
                  maxLength={160}
                  placeholder={bp.taglinePlaceholder}
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                />
              )}
            </Field>
            <Field label={bp.about} hint={bp.optional}>
              {(p) => (
                <Textarea
                  {...p}
                  rows={3}
                  maxLength={1000}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              )}
            </Field>
            <div className={formStyles.grid2}>
              <Field label={bp.publicPhone}>
                {(p) => (
                  <Input
                    {...p}
                    maxLength={40}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                )}
              </Field>
              <Field label={bp.publicEmail}>
                {(p) => (
                  <Input
                    {...p}
                    type="email"
                    maxLength={254}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <Field label={bp.address}>
              {(p) => (
                <Input
                  {...p}
                  maxLength={240}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              )}
            </Field>
            <Field label={bp.hoursText} hint={bp.hoursHint}>
              {(p) => (
                <Input
                  {...p}
                  maxLength={240}
                  placeholder={bp.hoursPlaceholder}
                  value={form.hoursNote}
                  onChange={(e) => setForm({ ...form, hoursNote: e.target.value })}
                />
              )}
            </Field>
          </Card>

          <Card title={bp.copy}>
            <Field label={bp.headline} hint={bp.optional}>
              {(p) => (
                <Input
                  {...p}
                  maxLength={120}
                  value={c.headline ?? ''}
                  onChange={(e) => setC({ headline: e.target.value })}
                />
              )}
            </Field>
            <Field label={bp.intro} hint={bp.optional}>
              {(p) => (
                <Textarea
                  {...p}
                  rows={2}
                  maxLength={400}
                  value={c.intro ?? ''}
                  onChange={(e) => setC({ intro: e.target.value })}
                />
              )}
            </Field>
            <div className={formStyles.grid2}>
              <Field label={bp.eyebrow} hint={bp.eyebrowHint}>
                {(p) => (
                  <Input
                    {...p}
                    maxLength={80}
                    value={c.eyebrow ?? ''}
                    onChange={(e) => setC({ eyebrow: e.target.value })}
                  />
                )}
              </Field>
              <Field label={bp.ctaLabel} hint={bp.ctaHint}>
                {(p) => (
                  <Input
                    {...p}
                    maxLength={40}
                    value={c.ctaLabel ?? ''}
                    onChange={(e) => setC({ ctaLabel: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#5d564b' }}>{bp.highlights}</span>
            {highlights.map((h, i) => (
              <div key={i} className={formStyles.grid2}>
                <Input
                  aria-label={bp.highlightTitle({ n: i + 1 })}
                  placeholder={bp.titlePlaceholder}
                  maxLength={40}
                  value={h.title}
                  onChange={(e) =>
                    setC({
                      highlights: highlights.map((x, j) =>
                        j === i ? { ...x, title: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Input
                  aria-label={bp.highlightText({ n: i + 1 })}
                  placeholder={bp.descPlaceholder}
                  maxLength={160}
                  value={h.body}
                  onChange={(e) =>
                    setC({
                      highlights: highlights.map((x, j) =>
                        j === i ? { ...x, body: e.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <Field label={bp.notesTitle} hint={bp.notesTitleHint}>
              {(p) => (
                <Input
                  {...p}
                  maxLength={60}
                  value={c.notesTitle ?? ''}
                  onChange={(e) => setC({ notesTitle: e.target.value })}
                />
              )}
            </Field>
            <Field label={bp.notes} hint={bp.notesHint}>
              {(p) => (
                <Textarea
                  {...p}
                  rows={4}
                  value={(c.notes ?? []).join('\n')}
                  onChange={(e) =>
                    setC({
                      notes: e.target.value
                        .split('\n')
                        .slice(0, 5)
                        .map((l) => l.slice(0, 200)),
                    })
                  }
                />
              )}
            </Field>
          </Card>
        </div>

        <PhotoManager photos={photos} enabled={uploadsEnabled} limit={photoLimit} />

        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
        {dirty ? (
          <div
            style={{
              position: 'sticky',
              bottom: 16,
              alignSelf: 'center',
              background: '#1c1a17',
              color: '#f4f0e8',
              borderRadius: 12,
              padding: '10px 10px 10px 18px',
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              boxShadow: '0 20px 40px -16px rgba(0,0,0,.5)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 600 }}>{bp.unsaved}</span>
            <button
              type="button"
              onClick={() => setForm(initial)}
              style={{
                appearance: 'none',
                border: '1px solid #4a463f',
                background: 'transparent',
                color: '#f4f0e8',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {bp.discard}
            </button>
            <Button variant="accent" disabled={pending || !form.displayName.trim()} onClick={save}>
              {bp.save}
            </Button>
          </div>
        ) : null}
      </PageContent>
    </>
  );
}
