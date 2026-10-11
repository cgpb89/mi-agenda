import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { listTenants } from '@/modules/platform/service';
import { BusinessesView } from '@/components/features/admin/BusinessesView';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.nav.businesses };
}

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
