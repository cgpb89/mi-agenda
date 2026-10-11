import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { listPlatformUsers } from '@/modules/platform/service';
import { UsersView } from '@/components/features/admin/UsersView';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.nav.users };
}

export default async function UsersPage() {
  const admin = await requirePlatformAdminPage();
  const users = await listPlatformUsers();
  return <UsersView users={users} selfId={admin.userId} />;
}
