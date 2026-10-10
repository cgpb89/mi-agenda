import type { Metadata } from 'next';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { readPageContent } from '@/modules/businesses/page-content';
import { BookingPageEditor } from '@/components/features/booking-page/BookingPageEditor';

export const metadata: Metadata = { title: 'Booking page' };

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
      }}
      pageStatus={profile.pageStatus}
      ready={{ services: onlineServices > 0, hours: rules > 0 }}
    />
  );
}
