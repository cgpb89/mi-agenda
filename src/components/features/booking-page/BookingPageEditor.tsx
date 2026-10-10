'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, FormMessage, Input, Textarea, formStyles } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { saveBookingPageAction, setPageStatusAction } from '@/modules/businesses/actions';
import type { PageContent as Content } from '@/modules/businesses/page-content';

type Template = 'BARBER' | 'WELLNESS' | 'CONSULT' | 'FITNESS' | 'SERVICES';

// Swatches from the design system's "Template identities".
const TEMPLATES: {
  key: Template;
  label: string;
  sample: string;
  bg: string;
  ink: string;
  accent: string;
  font: string;
  style?: React.CSSProperties;
}[] = [
  {
    key: 'BARBER',
    label: 'Barber & hair',
    sample: 'NORTHSIDE',
    bg: '#16120f',
    ink: '#f3ece2',
    accent: '#d6a15c',
    font: 'var(--font-anton), sans-serif',
  },
  {
    key: 'WELLNESS',
    label: 'Beauty & wellness',
    sample: 'Sable & Sage',
    bg: '#f4efe6',
    ink: '#3a3128',
    accent: '#7f6545',
    font: 'var(--font-cormorant), serif',
    style: { fontStyle: 'italic', fontWeight: 500 },
  },
  {
    key: 'CONSULT',
    label: 'Consultations',
    sample: 'Harbor Physio',
    bg: '#fff',
    ink: '#14233a',
    accent: '#1f5fbf',
    font: 'var(--font-public-sans), sans-serif',
    style: { fontWeight: 700 },
  },
  {
    key: 'FITNESS',
    label: 'Fitness & coaching',
    sample: 'FORGE/LAB',
    bg: '#0e0f0c',
    ink: '#f2f5ea',
    accent: '#c8f542',
    font: 'var(--font-archivo), sans-serif',
    style: { fontWeight: 900, fontStyle: 'italic', fontStretch: '62%' },
  },
  {
    key: 'SERVICES',
    label: 'General services',
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
}

export function BookingPageEditor({
  initial,
  pageStatus,
  ready,
}: {
  initial: Form;
  pageStatus: string;
  ready: { services: boolean; hours: boolean };
}) {
  const { data } = useShell();
  const slug = data.tenant.slug;
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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
      toast('Booking page saved');
      router.refresh();
    });
  }

  function setStatus(status: 'PUBLISHED' | 'UNPUBLISHED') {
    setError(null);
    startTransition(async () => {
      const res = await setPageStatusAction(slug, { status });
      if (!res.ok) return setError(res.error.message);
      toast(status === 'PUBLISHED' ? 'Booking page published' : 'Booking page unpublished');
      router.refresh();
    });
  }

  const published = pageStatus === 'PUBLISHED';

  return (
    <>
      <PageHeader title="Booking page" sub={`/book/${slug}`} hideNew>
        <a
          href={`/book/${slug}${published ? '' : '?preview=1'}`}
          target="_blank"
          rel="noopener"
          style={{ fontWeight: 600, fontSize: 13, color: '#c4581f' }}
        >
          {published ? 'View live page ↗' : 'Preview ↗'}
        </a>
      </PageHeader>
      <PageContent>
        <Card
          title="Status"
          action={
            <StatusPill
              status={published ? 'ACTIVE' : 'INACTIVE'}
              label={
                published ? 'Published' : pageStatus === 'UNPUBLISHED' ? 'Unpublished' : 'Draft'
              }
            />
          }
        >
          <span style={{ color: '#5d564b' }}>
            {published
              ? 'Customers can find your page and book online.'
              : 'Customers can’t see this page yet. Publish it when your services and hours are ready.'}
          </span>
          {!published && (!ready.services || !ready.hours) ? (
            <FormMessage kind="warning">
              Before publishing:{' '}
              {[!ready.services && 'add an online service', !ready.hours && 'set business hours']
                .filter(Boolean)
                .join(' and ')}
              .
            </FormMessage>
          ) : null}
          <div>
            {published ? (
              <Button variant="danger" disabled={pending} onClick={() => setStatus('UNPUBLISHED')}>
                Unpublish
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={pending || dirty}
                onClick={() => setStatus('PUBLISHED')}
              >
                Publish booking page
              </Button>
            )}
          </div>
        </Card>

        <Card title="Template">
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
                    {tp.label}
                  </span>
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 12, color: '#6b6358' }}>
            Each template changes layout, type and mood. Services, staff and availability work the
            same underneath.
          </span>
        </Card>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <Card title="Business details">
            <Field label="Name on the page">
              {(p) => (
                <Input
                  {...p}
                  maxLength={120}
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              )}
            </Field>
            <Field label="Tagline" hint="Optional">
              {(p) => (
                <Input
                  {...p}
                  maxLength={160}
                  placeholder="Brooklyn · Cuts, fades, shaves"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                />
              )}
            </Field>
            <Field label="About" hint="Optional">
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
              <Field label="Public phone">
                {(p) => (
                  <Input
                    {...p}
                    maxLength={40}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Public email">
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
            <Field label="Address">
              {(p) => (
                <Input
                  {...p}
                  maxLength={240}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              )}
            </Field>
            <Field label="Hours text" hint="Optional — otherwise shown from your business hours">
              {(p) => (
                <Input
                  {...p}
                  maxLength={240}
                  placeholder="Mon–Sat 9:00 AM – 7:00 PM · Sunday closed"
                  value={form.hoursNote}
                  onChange={(e) => setForm({ ...form, hoursNote: e.target.value })}
                />
              )}
            </Field>
          </Card>

          <Card title="Page copy">
            <Field label="Headline" hint="Optional">
              {(p) => (
                <Input
                  {...p}
                  maxLength={120}
                  value={c.headline ?? ''}
                  onChange={(e) => setC({ headline: e.target.value })}
                />
              )}
            </Field>
            <Field label="Intro" hint="Optional">
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
              <Field label="Eyebrow" hint="Barber">
                {(p) => (
                  <Input
                    {...p}
                    maxLength={80}
                    value={c.eyebrow ?? ''}
                    onChange={(e) => setC({ eyebrow: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Button label" hint="Wellness, fitness">
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
            <span style={{ fontSize: 12, fontWeight: 600, color: '#5d564b' }}>
              Highlights (category strip / info cards)
            </span>
            {highlights.map((h, i) => (
              <div key={i} className={formStyles.grid2}>
                <Input
                  aria-label={`Highlight ${i + 1} title`}
                  placeholder="Title"
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
                  aria-label={`Highlight ${i + 1} text`}
                  placeholder="Short description"
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
            <Field label="Notes section title" hint="e.g. Before your visit">
              {(p) => (
                <Input
                  {...p}
                  maxLength={60}
                  value={c.notesTitle ?? ''}
                  onChange={(e) => setC({ notesTitle: e.target.value })}
                />
              )}
            </Field>
            <Field label="Notes" hint="One per line, up to 5">
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
            <span style={{ fontSize: 12, color: '#6b6358' }}>
              Photos are shown as neutral placeholders. Image uploads are not part of this release.
            </span>
          </Card>
        </div>

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
            <span style={{ fontWeight: 600 }}>Unsaved booking page changes</span>
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
              Discard
            </button>
            <Button variant="accent" disabled={pending || !form.displayName.trim()} onClick={save}>
              Save changes
            </Button>
          </div>
        ) : null}
      </PageContent>
    </>
  );
}
