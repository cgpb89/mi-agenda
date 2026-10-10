'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/(auth)/actions';
import { ToastProvider } from '@/components/ui/Toast';
import s from './Admin.module.scss';

const NAV = [
  { href: '/super-admin', label: 'Overview' },
  { href: '/super-admin/businesses', label: 'Businesses' },
  { href: '/super-admin/users', label: 'Users' },
  { href: '/super-admin/plans', label: 'Plans', tag: 'NEXT' },
  { href: '/super-admin/templates', label: 'Templates', tag: 'NEXT' },
  { href: '/super-admin/settings', label: 'Settings & audit log' },
];

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; initials: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <ToastProvider platform>
      <div className={s.root}>
        <aside className={s.side} aria-label="Sidebar">
          <div className={s.brand}>
            <Link href="/">
              tempo<span>.</span>
            </Link>
            <span className={s.badge}>PLATFORM</span>
          </div>
          <nav aria-label="Platform" className={s.nav}>
            {NAV.map((n) => {
              const on =
                n.href === '/super-admin' ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? 'page' : undefined}
                  className={[s.navItem, on && s.navOn, n.tag && !on && s.navLater]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {n.label}
                  {n.tag ? <span>{n.tag}</span> : null}
                </Link>
              );
            })}
          </nav>
          <div className={s.foot}>
            <Link className={s.footLink} href="/app">
              Business app ↗
            </Link>
            <form action={logoutAction}>
              <button type="submit" className={s.footLink}>
                Sign out
              </button>
            </form>
            <div className={s.user}>
              <span aria-hidden="true">{user.initials}</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</span>
                <span style={{ fontSize: 11, color: '#8ea79d' }}>Platform admin</span>
              </span>
            </div>
          </div>
        </aside>
        <main className={s.main}>
          <div className={s.notice}>
            Business customer records are not visible here. Platform revenue is Tempo subscriptions,
            never a business&rsquo;s appointment revenue.
          </div>
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
