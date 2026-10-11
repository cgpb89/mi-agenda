import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { AdminShell } from '@/components/features/admin/AdminShell';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.admin.metaTitle, template: t.admin.metaTemplate },
    robots: { index: false, follow: false },
  };
}

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  // Platform role is checked on every request; non-admins get a 404.
  const user = await requirePlatformAdminPage();
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return <AdminShell user={{ name: user.name, initials }}>{children}</AdminShell>;
}
