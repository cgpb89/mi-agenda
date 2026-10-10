import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadPublicPage } from '@/modules/public/booking-page';
import { findByManageToken } from '@/modules/public/manage';
import { BookingFlow } from '@/components/features/booking/BookingFlow';
import { templateStyles as s } from '@/components/features/booking/Templates';

// The URL carries a secret: never leak it via Referer, never index it.
export const metadata: Metadata = {
  title: 'Your appointment',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const [page, appt] = await Promise.all([loadPublicPage(slug), findByManageToken(slug, token)]);
  if (!page || !appt) notFound();
  return (
    <main
      className={s.frame}
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
        <Link href={`/book/${page.slug}`}>Back to {page.profile.displayName}</Link> · Booking pages
        by <Link href="/">Tempo</Link>
      </div>
    </main>
  );
}
