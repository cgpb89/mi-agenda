import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { withTransaction } from '@/lib/db/tx';
import { findValidInvitation } from '@/modules/tenants/invitations';
import styles from '@/components/features/auth/Auth.module.scss';
import { InviteForm } from '@/components/features/auth/InviteForm';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.invite.metaTitle, referrer: 'no-referrer' };
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === 'string' && token.length >= 20 && token.length <= 128;
  const inv = valid ? await withTransaction((tx) => findValidInvitation(tx, token)) : null;
  const user = await getSessionUser();
  const { t } = await getI18n();

  if (!inv) {
    return (
      <div className={styles.card}>
        <span className={styles.eyebrow}>{t.auth.invite.eyebrow}</span>
        <h1 className={styles.title}>{t.auth.invite.unusableTitle}</h1>
        <p className={styles.sub}>{t.auth.invite.unusableBody}</p>
      </div>
    );
  }
  const mismatch = user && user.email !== inv.email;
  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>{t.auth.invite.eyebrow}</span>
      <h1 className={styles.title}>{t.auth.invite.title({ business: inv.tenant.name })}</h1>
      <p className={styles.sub}>
        {t.auth.invite.invitedAs({ role: inv.role === 'MANAGER' ? 'MANAGER' : 'STAFF' })}{' '}
        <strong>{inv.email}</strong>.
      </p>
      {mismatch ? (
        <p className={styles.sub}>
          {t.auth.invite.signedInAs({ email: user.email })}{' '}
          <Link href={`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`}>
            {t.auth.invite.signInAs({ email: inv.email })}
          </Link>{' '}
          {t.auth.invite.toAccept}
        </p>
      ) : (
        <InviteForm token={token!} signedIn={Boolean(user)} />
      )}
    </div>
  );
}
