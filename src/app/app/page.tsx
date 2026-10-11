import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { requireUserPage } from '@/lib/auth/authorize';
import styles from '@/components/features/auth/Auth.module.scss';
import { ButtonLink } from '@/components/ui/Button';
import { logoutAction } from '@/app/(auth)/actions';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.noBusiness.metaTitle };
}

/** Entry point after login: go to the first business the user belongs to. */
export default async function AppIndex() {
  const user = await requireUserPage('/app');
  const m = await getDb().membership.findFirst({
    where: {
      userId: user.userId,
      status: 'ACTIVE',
      tenant: { status: { in: ['TRIAL', 'ACTIVE'] } },
    },
    orderBy: { createdAt: 'asc' },
    select: { tenant: { select: { slug: true } } },
  });
  if (m) redirect(`/app/${m.tenant.slug}/overview`);
  const { t } = await getI18n();
  const nb = t.app.noBusiness;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.logo} aria-label={t.common.homeLabel}>
          tempo<span>.</span>
        </Link>
        <LocaleSwitcher />
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <span className={styles.eyebrow}>{nb.eyebrow}</span>
          <h1 className={styles.title}>{nb.title}</h1>
          <p className={styles.sub}>{nb.body}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {user.platformRole === 'ADMIN' ? (
              <ButtonLink href="/super-admin" variant="primary">
                {nb.platformAdmin}
              </ButtonLink>
            ) : null}
            <form action={logoutAction}>
              <button
                type="submit"
                className={styles.topLink}
                style={{ background: 'none', border: 0, cursor: 'pointer', padding: '10px 0' }}
              >
                {t.app.signOut}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
