import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { listTenants } from '@/modules/platform/service';
import { BusinessesView } from '@/components/features/admin/BusinessesView';

export const metadata: Metadata = { title: 'Businesses' };

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  await requirePlatformAdminPage();
  const { open } = await searchParams;
  const tenants = await listTenants();
  return <BusinessesView tenants={tenants} openId={open ?? null} />;
}
