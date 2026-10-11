import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadPublicPage } from '@/modules/public/booking-page';
import { findByManageToken } from '@/modules/public/manage';
import { BookingFlow } from '@/components/features/booking/BookingFlow';
import { templateStyles as s } from '@/components/features/booking/Templates';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { I18nProvider } from '@/i18n/client';
import { getI18n, i18nFor } from '@/i18n/server';

// The URL carries a secret: never leak it via Referer, never index it.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.booking.page.manageTitle,
    referrer: 'no-referrer',
    robots: { index: false, follow: false },
  };
}

export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const [page, appt] = await Promise.all([loadPublicPage(slug), findByManageToken(slug, token)]);
  if (!page || !appt) notFound();
  const { t } = i18nFor(page.locale);
  return (
    <I18nProvider locale={page.locale}>
      <main
        className={s.frame}
        lang={page.locale}
        style={{
          minHeight: '100dvh',
          background: '#e9e6e1',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'grid',
            placeItems: 'start center',
            padding: 'clamp(16px, 4vw, 48px) 12px',
          }}
        >
          <div style={{ width: 'min(100%, 560px)' }}>
            <BookingFlow
              slug={page.slug}
              template={page.template}
              accent={page.brand?.accent ?? null}
              businessName={page.profile.displayName}
              timezone={page.timezone}
              currency={page.currency}
              country={page.country}
              address={page.profile.address}
              policyText={page.policy.policyText}
              requireEmail={page.policy.requireEmail}
              minNoticeMin={page.policy.minNoticeMin}
              cancellationWindowMin={page.policy.cancellationWindowMin}
              services={page.services}
              staff={page.staff}
              existing={{
                token,
                confirmationCode: appt.confirmationCode,
                status: appt.status,
                serviceId: appt.serviceId,
                serviceName: appt.serviceNameSnapshot,
                staffId: appt.staffId,
                staffName: appt.staff.displayName,
                startAt: appt.startAt.toISOString(),
                endAt: appt.endAt.toISOString(),
                durationMin: appt.durationMin,
                priceMinor: appt.quotedPriceMinor,
                contactName: appt.contactName,
                contactEmail: appt.contactEmail,
                canModify: appt.canModify,
                cancellationWindowMin: appt.cancellationWindowMin,
              }}
            />
          </div>
        </div>
        <div className={s.poweredBy}>
          <span>
            <Link href={`/book/${page.slug}`}>
              {t.booking.page.backTo({ business: page.profile.displayName })}
            </Link>{' '}
            · {t.booking.page.poweredBy} <Link href="/">Tempo</Link>
          </span>
          <LocaleSwitcher />
        </div>
      </main>
    </I18nProvider>
  );
}
