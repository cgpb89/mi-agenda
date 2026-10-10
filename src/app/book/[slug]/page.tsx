import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { loadPublicPage } from '@/modules/public/booking-page';
import { BookingFlow } from '@/components/features/booking/BookingFlow';
import { TEMPLATES, templateStyles as s } from '@/components/features/booking/Templates';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

async function load(slug: string, preview: boolean) {
  const user = preview ? await getSessionUser() : null;
  return loadPublicPage(slug, { allowDraftFor: user?.userId });
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug, (await searchParams).preview === '1');
  if (!page) return { title: 'Not found' };
  return {
    title: { absolute: `${page.profile.displayName} — Book an appointment` },
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
  const Template = TEMPLATES[page.template];
  const flow = (
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
      preview={!page.published}
    />
  );
  return (
    <main className={s.frame}>
      {!page.published ? (
        <div className={s.preview}>
          Preview · this page isn&rsquo;t published, so customers can&rsquo;t see it or book yet.
        </div>
      ) : null}
      <Template page={page} flow={flow} />
      <div className={s.poweredBy}>
        Booking pages by <Link href="/">Tempo</Link>
      </div>
    </main>
  );
}
