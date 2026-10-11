import type { Metadata } from 'next';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { cloudName, imageUrl } from '@/lib/cloudinary';
import { isCloudinaryConfigured } from '@/lib/env';
import { readPageContent } from '@/modules/businesses/page-content';
import { readPhotos } from '@/modules/businesses/photos';
import { entitlementsFor } from '@/modules/plans/service';
import { BookingPageEditor } from '@/components/features/booking-page/BookingPageEditor';
import { getI18n } from '@/i18n/server';
import { DEFAULT_LOCALE, toLocale } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.nav['booking-page'] };
}

export default async function BookingPageSettings({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const ctx = await requireTenantPage(tenant, 'bookingPage.manage');
  const db = getDb();
  const [profile, onlineServices, rules] = await Promise.all([
    db.businessProfile.findUniqueOrThrow({ where: { tenantId: ctx.tenantId } }),
    db.service.count({ where: { tenantId: ctx.tenantId, isActive: true, isOnline: true } }),
    db.availabilityRule.count({ where: { tenantId: ctx.tenantId, staffId: null } }),
  ]);
  const uploadsEnabled = isCloudinaryConfigured();
  const plan = await entitlementsFor(ctx.plan);
  const photos = uploadsEnabled
    ? readPhotos(profile.photos).map((p) => ({
        id: p.id,
        thumb: imageUrl(cloudName(), p.publicId, p.version, { width: 480, height: 360 }),
      }))
    : [];
  return (
    <BookingPageEditor
      initial={{
        displayName: profile.displayName,
        tagline: profile.tagline ?? '',
        description: profile.description ?? '',
        phone: profile.phone ?? '',
        email: profile.email ?? '',
        address: profile.address ?? '',
        hoursNote: profile.hoursNote ?? '',
        template: profile.template,
        content: readPageContent(profile.pageContent),
        locale: toLocale(ctx.locale) ?? DEFAULT_LOCALE,
      }}
      pageStatus={profile.pageStatus}
      ready={{ services: onlineServices > 0, hours: rules > 0 }}
      photos={photos}
      uploadsEnabled={uploadsEnabled}
      photoLimit={plan.photoLimit}
    />
  );
}
