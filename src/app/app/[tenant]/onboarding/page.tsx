import type { Metadata } from 'next';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { summarizeHours } from '@/modules/public/booking-page';
import { OnboardingView } from '@/components/features/onboarding/OnboardingView';

export const metadata: Metadata = { title: 'Set up your business' };

export default async function OnboardingPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const ctx = await requireTenantPage(tenant, 'business.manage');
  const db = getDb();
  const [profile, services, staff, rules, policy] = await Promise.all([
    db.businessProfile.findUniqueOrThrow({ where: { tenantId: ctx.tenantId } }),
    db.service.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { id: true, name: true, durationMin: true, priceMinor: true },
    }),
    db.staff.findMany({ where: { tenantId: ctx.tenantId, isActive: true }, select: { id: true } }),
    db.availabilityRule.findMany({
      where: { tenantId: ctx.tenantId, staffId: null },
      select: { dayOfWeek: true, startMin: true, endMin: true },
    }),
    db.bookingPolicy.findUniqueOrThrow({ where: { tenantId: ctx.tenantId } }),
  ]);
  return (
    <OnboardingView
      profileDone={Boolean(profile.address || profile.phone || profile.description)}
      services={services}
      staffIds={staff.map((s) => s.id)}
      hours={summarizeHours(rules)}
      maxPerPhone={policy.maxActiveAppointmentsPerPhone}
      published={profile.pageStatus === 'PUBLISHED'}
      currency={ctx.currency}
    />
  );
}
