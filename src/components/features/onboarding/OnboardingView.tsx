'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Button, ButtonLink } from '@/components/ui/Button';
import { FormMessage, Input, Select } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';
import { moneyFmt } from '@/components/features/shared/format';
import { saveServiceAction } from '@/modules/services/actions';
import { saveAvailabilityAction } from '@/modules/scheduling/actions';
import { setPageStatusAction } from '@/modules/businesses/actions';
import { DURATIONS } from '@/modules/services/constants';

const PRESETS: Record<
  string,
  { label: string; week: Record<string, { start: number; end: number }[]> }
> = {
  weekdays: {
    label: 'Mon–Fri 9:00 AM – 5:00 PM',
    week: Object.fromEntries(
      ['1', '2', '3', '4', '5', '6', '7'].map((d) => [
        d,
        Number(d) <= 5 ? [{ start: 540, end: 1020 }] : [],
      ]),
    ),
  },
  shop: {
    label: 'Mon–Sat 9:00 AM – 7:00 PM, lunch 1:00–1:30',
    week: Object.fromEntries(
      ['1', '2', '3', '4', '5', '6', '7'].map((d) => [
        d,
        Number(d) <= 6
          ? [
              { start: 540, end: 780 },
              { start: 810, end: 1140 },
            ]
          : [],
      ]),
    ),
  },
  late: {
    label: 'Tue–Sat 10:00 AM – 7:00 PM',
    week: Object.fromEntries(
      ['1', '2', '3', '4', '5', '6', '7'].map((d) => [
        d,
        Number(d) >= 2 && Number(d) <= 6 ? [{ start: 600, end: 1140 }] : [],
      ]),
    ),
  },
};

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #e7e2d9',
        borderRadius: 12,
        padding: 18,
        display: 'grid',
        gridTemplateColumns: '36px minmax(0, 1fr)',
        gap: 14,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 800,
          background: done ? '#2f6e5a' : '#ebe6dd',
          color: done ? '#fff' : '#1c1a17',
        }}
      >
        {done ? '✓' : n}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <h2
          style={{
            fontFamily: 'var(--font-bricolage)',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-.02em',
          }}
        >
          {title}{' '}
          {done ? (
            <span style={{ fontSize: 12, color: '#2f6e5a', fontFamily: 'var(--font-hanken)' }}>
              · Done
            </span>
          ) : null}
        </h2>
        {children}
      </div>
    </section>
  );
}

export function OnboardingView(props: {
  profileDone: boolean;
  services: { id: string; name: string; durationMin: number; priceMinor: number }[];
  staffIds: string[];
  hours: string[];
  maxPerPhone: number;
  published: boolean;
  currency: string;
}) {
  const { data } = useShell();
  const slug = data.tenant.slug;
  const base = `/app/${slug}`;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [svc, setSvc] = useState({ name: '', durationMin: 45, price: '' });
  const [error, setError] = useState<string | null>(null);

  function addService() {
    setError(null);
    startTransition(async () => {
      const res = await saveServiceAction(slug, {
        name: svc.name,
        description: '',
        durationMin: svc.durationMin,
        price: svc.price || '0',
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        staffIds: props.staffIds,
        availableOn: 'ALL',
        maxAdvanceDays: '',
        isOnline: true,
      });
      if (!res.ok) return setError(res.error.message);
      setSvc({ name: '', durationMin: 45, price: '' });
      toast(`${res.data.name} added`);
      router.refresh();
    });
  }

  function applyPreset(key: string) {
    setError(null);
    startTransition(async () => {
      const res = await saveAvailabilityAction(slug, {
        business: PRESETS[key]!.week,
        staff: {},
        rules: {
          slotIntervalMin: 30,
          minNoticeMin: 60,
          maxAdvanceDays: 60,
          timezone: data.tenant.timezone,
        },
      });
      if (!res.ok) return setError(res.error.message);
      toast('Business hours saved');
      router.refresh();
    });
  }

  function publish() {
    setError(null);
    startTransition(async () => {
      const res = await setPageStatusAction(slug, { status: 'PUBLISHED' });
      if (!res.ok) return setError(res.error.message);
      toast('Booking page published');
      router.push(`${base}/overview`);
    });
  }

  return (
    <>
      <PageHeader
        title="Set up your business"
        sub="Five steps to your first online booking"
        hideNew
      />
      <PageContent>
        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820 }}>
          <Step n={1} title="Business details" done={props.profileDone}>
            <span style={{ color: '#5d564b' }}>
              Address, phone and a short description customers will see on your page.
            </span>
            <div>
              <ButtonLink href={`${base}/booking-page`}>Edit booking page details</ButtonLink>
            </div>
          </Step>

          <Step n={2} title="Services and prices" done={props.services.length > 0}>
            {props.services.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: '#5d564b' }}>
                {props.services.map((x) => (
                  <li key={x.id}>
                    {x.name} · {x.durationMin} min · {moneyFmt(x.priceMinor, props.currency)}
                  </li>
                ))}
              </ul>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Input
                aria-label="Service name"
                placeholder="Service name, e.g. Classic Cut"
                maxLength={80}
                style={{ flex: '2 1 200px' }}
                value={svc.name}
                onChange={(e) => setSvc({ ...svc, name: e.target.value })}
              />
              <Select
                aria-label="Duration"
                style={{ flex: '1 1 110px' }}
                value={svc.durationMin}
                onChange={(e) => setSvc({ ...svc, durationMin: Number(e.target.value) })}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </Select>
              <Input
                aria-label={`Price (${props.currency})`}
                placeholder={`Price (${props.currency})`}
                inputMode="decimal"
                style={{ flex: '1 1 110px' }}
                value={svc.price}
                onChange={(e) => setSvc({ ...svc, price: e.target.value })}
              />
              <Button variant="primary" disabled={pending || !svc.name.trim()} onClick={addService}>
                Add
              </Button>
            </div>
            <span style={{ fontSize: 12, color: '#6b6358' }}>
              Buffers, staff and online visibility can be changed in{' '}
              <Link href={`${base}/services`}>Services</Link>.
            </span>
          </Step>

          <Step n={3} title="Business hours" done={props.hours.length > 0}>
            <span style={{ color: '#5d564b' }}>
              {props.hours.length ? `Currently: ${props.hours.join(' · ')}` : 'No hours yet.'}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(PRESETS).map(([k, p]) => (
                <Button key={k} pill disabled={pending} onClick={() => applyPreset(k)}>
                  {p.label}
                </Button>
              ))}
              <ButtonLink pill href={`${base}/availability`}>
                Custom hours, staff shifts and holidays →
              </ButtonLink>
            </div>
          </Step>

          <Step n={4} title="Booking policy" done>
            <span style={{ color: '#5d564b' }}>
              Each phone number can hold up to <strong>{props.maxPerPhone}</strong> upcoming
              appointment{props.maxPerPhone === 1 ? '' : 's'} at a time. Cancellation window and
              confirmation rules are in settings.
            </span>
            <div>
              <ButtonLink href={`${base}/settings`}>Review booking policy</ButtonLink>
            </div>
          </Step>

          <Step n={5} title="Publish your booking page" done={props.published}>
            <span style={{ color: '#5d564b' }}>
              {props.published ? (
                <>
                  Live at <a href={`/book/${slug}`}>/book/{slug}</a>.
                </>
              ) : (
                <>
                  Check the{' '}
                  <a href={`/book/${slug}?preview=1`} target="_blank" rel="noopener">
                    preview
                  </a>
                  , then publish.
                </>
              )}
            </span>
            {!props.published ? (
              <div>
                <Button
                  variant="accent"
                  disabled={pending || !props.services.length || !props.hours.length}
                  onClick={publish}
                >
                  Publish booking page
                </Button>
              </div>
            ) : (
              <div>
                <ButtonLink variant="primary" href={`${base}/overview`}>
                  Go to overview
                </ButtonLink>
              </div>
            )}
          </Step>
        </div>
      </PageContent>
    </>
  );
}
