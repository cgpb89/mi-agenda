import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { AdminHeader } from '@/components/features/admin/AdminShell';
import { PlansEditor } from '@/components/features/admin/PlansEditor';
import s from '@/components/features/admin/Admin.module.scss';
import { getPlanCatalog } from '@/modules/plans/service';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.nav.plans };
}

export default async function PlansPage() {
  await requirePlatformAdminPage();
  const [{ t }, catalog] = await Promise.all([getI18n(), getPlanCatalog()]);
  return (
    <>
      <AdminHeader title={t.admin.nav.plans} sub={t.admin.plans.sub} />
      <div className={s.content}>
        <PlansEditor initial={catalog} />
      </div>
    </>
  );
}
