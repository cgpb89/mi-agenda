import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { listPlatformUsers } from '@/modules/platform/service';
import { UsersView } from '@/components/features/admin/UsersView';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage() {
  const admin = await requirePlatformAdminPage();
  const users = await listPlatformUsers();
  return <UsersView users={users} selfId={admin.userId} />;
}
