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
import { useI18n } from '@/i18n/client';

const PRESETS: Record<
  'weekdays' | 'shop' | 'late',
  { week: Record<string, { start: number; end: number }[]> }
> = {
  weekdays: {
    week: Object.fromEntries(
      ['1', '2', '3', '4', '5', '6', '7'].map((d) => [
        d,
        Number(d) <= 5 ? [{ start: 540, end: 1020 }] : [],
      ]),
    ),
  },
  shop: {
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
  const { t } = useI18n();
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
              {t.onboarding.done}
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
  const { t, locale } = useI18n();
  const ob = t.onboarding;

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
      toast(ob.toastAdded({ name: res.data.name }));
      router.refresh();
    });
  }

  function applyPreset(key: keyof typeof PRESETS) {
    setError(null);
    startTransition(async () => {
      const res = await saveAvailabilityAction(slug, {
        business: PRESETS[key].week,
        staff: {},
        rules: {
          slotIntervalMin: 30,
          minNoticeMin: 60,
          maxAdvanceDays: 60,
          timezone: data.tenant.timezone,
        },
      });
      if (!res.ok) return setError(res.error.message);
      toast(ob.toastHours);
      router.refresh();
    });
  }

  function publish() {
    setError(null);
    startTransition(async () => {
      const res = await setPageStatusAction(slug, { status: 'PUBLISHED' });
      if (!res.ok) return setError(res.error.message);
      toast(ob.toastPublished);
      router.push(`${base}/overview`);
    });
  }

  return (
    <>
      <PageHeader title={t.app.titles.onboarding} sub={ob.sub} hideNew />
      <PageContent>
        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820 }}>
          <Step n={1} title={ob.step1} done={props.profileDone}>
            <span style={{ color: '#5d564b' }}>{ob.step1Body}</span>
            <div>
              <ButtonLink href={`${base}/booking-page`}>{ob.step1Cta}</ButtonLink>
            </div>
          </Step>

          <Step n={2} title={ob.step2} done={props.services.length > 0}>
            {props.services.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: '#5d564b' }}>
                {props.services.map((x) => (
                  <li key={x.id}>
                    {x.name} · {x.durationMin} {ob.min} ·{' '}
                    {moneyFmt(x.priceMinor, props.currency, locale)}
                  </li>
                ))}
              </ul>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Input
                aria-label={ob.serviceName}
                placeholder={ob.serviceNamePlaceholder}
                maxLength={80}
                style={{ flex: '2 1 200px' }}
                value={svc.name}
                onChange={(e) => setSvc({ ...svc, name: e.target.value })}
              />
              <Select
                aria-label={ob.duration}
                style={{ flex: '1 1 110px' }}
                value={svc.durationMin}
                onChange={(e) => setSvc({ ...svc, durationMin: Number(e.target.value) })}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} {ob.min}
                  </option>
                ))}
              </Select>
              <Input
                aria-label={ob.price({ currency: props.currency })}
                placeholder={ob.price({ currency: props.currency })}
                inputMode="decimal"
                style={{ flex: '1 1 110px' }}
                value={svc.price}
                onChange={(e) => setSvc({ ...svc, price: e.target.value })}
              />
              <Button variant="primary" disabled={pending || !svc.name.trim()} onClick={addService}>
                {ob.add}
              </Button>
            </div>
            <span style={{ fontSize: 12, color: '#6b6358' }}>
              {ob.step2Note} <Link href={`${base}/services`}>{ob.servicesLink}</Link>.
            </span>
          </Step>

          <Step n={3} title={ob.step3} done={props.hours.length > 0}>
            <span style={{ color: '#5d564b' }}>
              {props.hours.length ? ob.currently({ hours: props.hours.join(' · ') }) : ob.noHours}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
                <Button key={k} pill disabled={pending} onClick={() => applyPreset(k)}>
                  {ob.presets[k]}
                </Button>
              ))}
              <ButtonLink pill href={`${base}/availability`}>
                {ob.customHours}
              </ButtonLink>
            </div>
          </Step>

          <Step n={4} title={ob.step4} done>
            <span style={{ color: '#5d564b' }}>{ob.policyBody({ n: props.maxPerPhone })}</span>
            <div>
              <ButtonLink href={`${base}/settings`}>{ob.reviewPolicy}</ButtonLink>
            </div>
          </Step>

          <Step n={5} title={ob.step5} done={props.published}>
            <span style={{ color: '#5d564b' }}>
              {props.published ? (
                <>
                  {ob.liveAt} <a href={`/book/${slug}`}>/book/{slug}</a>.
                </>
              ) : (
                <>
                  {ob.checkThe}{' '}
                  <a href={`/book/${slug}?preview=1`} target="_blank" rel="noopener">
                    {ob.preview}
                  </a>
                  {ob.thenPublish}
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
                  {ob.publish}
                </Button>
              </div>
            ) : (
              <div>
                <ButtonLink variant="primary" href={`${base}/overview`}>
                  {ob.goOverview}
                </ButtonLink>
              </div>
            )}
          </Step>
        </div>
      </PageContent>
    </>
  );
}
