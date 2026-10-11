'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/(auth)/actions';
import { ToastProvider } from '@/components/ui/Toast';
import s from './Admin.module.scss';
import { useI18n } from '@/i18n/client';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';

const NAV = [
  { href: '/super-admin', key: 'overview', later: false },
  { href: '/super-admin/businesses', key: 'businesses', later: false },
  { href: '/super-admin/users', key: 'users', later: false },
  { href: '/super-admin/plans', key: 'plans', later: false },
  { href: '/super-admin/templates', key: 'templates', later: true },
  { href: '/super-admin/settings', key: 'settings', later: false },
] as const;

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; initials: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const a = t.admin;
  return (
    <ToastProvider platform>
      <div className={s.root}>
        <aside className={s.side} aria-label={a.sidebar}>
          <div className={s.brand}>
            <Link href="/" aria-label={t.common.homeLabel}>
              tempo<span>.</span>
            </Link>
            <span className={s.badge}>{a.platformBadge}</span>
          </div>
          <nav aria-label={a.platformNav} className={s.nav}>
            {NAV.map((n) => {
              const on =
                n.href === '/super-admin' ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? 'page' : undefined}
                  className={[s.navItem, on && s.navOn, n.later && !on && s.navLater]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {a.nav[n.key]}
                  {n.later ? <span>{a.next}</span> : null}
                </Link>
              );
            })}
          </nav>
          <div className={s.foot}>
            <Link className={s.footLink} href="/app">
              {a.businessApp}
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <form action={logoutAction}>
                <button type="submit" className={s.footLink}>
                  {a.signOut}
                </button>
              </form>
              <LocaleSwitcher />
            </div>
            <div className={s.user}>
              <span aria-hidden="true">{user.initials}</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</span>
                <span style={{ fontSize: 11, color: '#8ea79d' }}>{a.platformAdmin}</span>
              </span>
            </div>
          </div>
        </aside>
        <main className={s.main}>
          <div className={s.notice}>{a.notice}</div>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

export function AdminHeader({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <header className={s.header}>
      <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column' }}>
        <h1>{title}</h1>
        {sub ? <span>{sub}</span> : null}
      </div>
      {children}
    </header>
  );
}
