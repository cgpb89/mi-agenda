import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { loadPublicPage } from '@/modules/public/booking-page';
import { BookingFlow } from '@/components/features/booking/BookingFlow';
import { TEMPLATES, templateStyles as s } from '@/components/features/booking/Templates';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { I18nProvider } from '@/i18n/client';
import { getI18n, i18nFor } from '@/i18n/server';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

async function load(slug: string, preview: boolean) {
  const user = preview ? await getSessionUser() : null;
  return loadPublicPage(slug, { allowDraftFor: user?.userId });
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug, (await searchParams).preview === '1');
  if (!page) return { title: (await getI18n()).t.booking.page.notFound };
  const { t } = i18nFor(page.locale);
  return {
    title: { absolute: t.booking.page.metaTitle({ business: page.profile.displayName }) },
    description: page.profile.tagline ?? page.profile.description ?? undefined,
    robots: page.published ? undefined : { index: false, follow: false },
  };
}

export default async function BookingPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const preview = (await searchParams).preview === '1';
  const page = await load(slug, preview);
  // Unknown, suspended and unpublished businesses are indistinguishable.
  if (!page) notFound();
  const { t } = i18nFor(page.locale);
  const Template = TEMPLATES[page.template];
  const flow = (
    <BookingFlow
      slug={page.slug}
      template={page.template}
      glass={page.glass}
      accent={page.brand?.accent ?? null}
      businessName={page.profile.displayName}
      timezone={page.timezone}
      currency={page.currency}
      country={page.country}
      address={page.profile.address}
      policyText={page.policy.policyText}
      deposit={page.policy.deposit ?? undefined}
      requireEmail={page.policy.requireEmail}
      minNoticeMin={page.policy.minNoticeMin}
      cancellationWindowMin={page.policy.cancellationWindowMin}
      services={page.services}
      staff={page.staff}
      preview={!page.published}
    />
  );
  return (
    <I18nProvider locale={page.locale}>
      <main className={s.frame} lang={page.locale}>
        {!page.published ? <div className={s.preview}>{t.booking.page.preview}</div> : null}
        <Template page={page} flow={flow} />
        <div className={s.poweredBy}>
          {page.hideBranding ? null : (
            <span>
              {t.booking.page.poweredBy} <Link href="/">Tempo</Link>
            </span>
          )}
          <LocaleSwitcher />
        </div>
      </main>
    </I18nProvider>
  );
}
