import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { AdminHeader } from '@/components/features/admin/AdminShell';
import s from '@/components/features/admin/Admin.module.scss';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.nav.plans };
}

export default async function PlansPage() {
  await requirePlatformAdminPage();
  const { t } = await getI18n();
  return (
    <>
      <AdminHeader title={t.admin.nav.plans} />
      <div className={s.content}>
        <div className={s.later}>
          <span>{t.admin.later}</span>
          <span>{t.admin.nav.plans}</span>
          <span>{t.admin.plansLater}</span>
        </div>
      </div>
    </>
  );
}
