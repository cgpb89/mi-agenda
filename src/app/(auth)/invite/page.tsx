import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { withTransaction } from '@/lib/db/tx';
import { findValidInvitation } from '@/modules/tenants/invitations';
import styles from '@/components/features/auth/Auth.module.scss';
import { InviteForm } from '@/components/features/auth/InviteForm';

export const metadata: Metadata = { title: 'Join a team', referrer: 'no-referrer' };

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === 'string' && token.length >= 20 && token.length <= 128;
  const inv = valid ? await withTransaction((tx) => findValidInvitation(tx, token)) : null;
  const user = await getSessionUser();

  if (!inv) {
    return (
      <div className={styles.card}>
        <span className={styles.eyebrow}>Invitation</span>
        <h1 className={styles.title}>This invitation can&rsquo;t be used</h1>
        <p className={styles.sub}>
          It may have expired, been revoked or already accepted. Ask the business owner to send a
          new one.
        </p>
      </div>
    );
  }
  const mismatch = user && user.email !== inv.email;
  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>Invitation</span>
      <h1 className={styles.title}>Join {inv.tenant.name}</h1>
      <p className={styles.sub}>
        You&rsquo;ve been invited as {inv.role === 'MANAGER' ? 'a manager' : 'staff'} using{' '}
        <strong>{inv.email}</strong>.
      </p>
      {mismatch ? (
        <p className={styles.sub}>
          You&rsquo;re signed in as {user.email}.{' '}
          <Link href={`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`}>
            Sign in as {inv.email}
          </Link>{' '}
          to accept.
        </p>
      ) : (
        <InviteForm token={token!} signedIn={Boolean(user)} />
      )}
    </div>
  );
}
