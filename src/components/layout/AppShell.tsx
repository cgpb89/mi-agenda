'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { logoutAction } from '@/app/(auth)/actions';
import { ToastProvider } from '@/components/ui/Toast';
import {
  NewAppointmentModal,
  type NewAppointmentPrefill,
} from '@/components/features/appointments/NewAppointmentModal';
import { AppointmentDrawer } from '@/components/features/appointments/AppointmentDrawer';
import styles from './AppShell.module.scss';

export interface ShellService {
  id: string;
  name: string;
  durationMin: number;
  priceMinor: number;
  currency: string;
  isActive: boolean;
}

export interface ShellStaff {
  id: string;
  name: string;
  serviceIds: string[];
}

export interface ShellData {
  tenant: {
    slug: string;
    name: string;
    timezone: string;
    currency: string;
    country: string;
    pageStatus: string;
    today: string;
  };
  memberships: { slug: string; name: string; sub: string }[];
  user: { name: string; initials: string; roleLabel: string; isPlatformAdmin: boolean };
  nav: { key: string; label: string; href: string }[];
  booking: { services: ShellService[]; staff: ShellStaff[]; defaultStaffId: string | null } | null;
}

interface ShellCtx {
  data: ShellData;
  openNav: () => void;
  openNewAppointment: (prefill?: NewAppointmentPrefill) => void;
}

const Ctx = createContext<ShellCtx | null>(null);

export function useShell(): ShellCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShell must be used inside AppShell');
  return v;
}

export function AppShell({ data, children }: { data: ShellData; children: ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const [newAppt, setNewAppt] = useState<{
    open: boolean;
    prefill?: NewAppointmentPrefill;
    n: number;
  }>({ open: false, n: 0 });

  // Navigating closes the drawer and the business menu (state derived during render).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setNavOpen(false);
    setBizOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBizOpen(false);
        setNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openNewAppointment = useCallback(
    (prefill?: NewAppointmentPrefill) => setNewAppt((s) => ({ open: true, prefill, n: s.n + 1 })),
    [],
  );
  const ctx = useMemo<ShellCtx>(
    () => ({ data, openNav: () => setNavOpen(true), openNewAppointment }),
    [data, openNewAppointment],
  );
  const current = data.memberships.find((m) => m.slug === data.tenant.slug);

  return (
    <Ctx.Provider value={ctx}>
      <ToastProvider>
        <div className={styles.root}>
          <aside
            className={[styles.side, navOpen && styles.sideOpen].filter(Boolean).join(' ')}
            aria-label="Sidebar"
          >
            <div className={styles.brandRow}>
              <Link href="/" className={styles.logo}>
                tempo<span>.</span>
              </Link>
              <button
                type="button"
                className={styles.closeNav}
                aria-label="Close menu"
                onClick={() => setNavOpen(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.switcher}>
              <button
                type="button"
                className={styles.bizButton}
                aria-expanded={bizOpen}
                onClick={() => setBizOpen((o) => !o)}
              >
                <span className={styles.bizAvatar} aria-hidden="true">
                  {data.tenant.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className={styles.bizText}>
                  <span className={styles.bizName}>{data.tenant.name}</span>
                  <span className={styles.bizSub}>{current?.sub}</span>
                </span>
                <span className={styles.caret} aria-hidden="true">
                  ▾
                </span>
              </button>
              {bizOpen ? (
                <div className={styles.menu}>
                  {data.memberships.map((m) => (
                    <Link
                      key={m.slug}
                      href={`/app/${m.slug}/overview`}
                      className={[styles.menuItem, m.slug === data.tenant.slug && styles.menuItemOn]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                      <span style={{ fontSize: 11, color: '#a29a8d' }}>{m.sub}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <nav aria-label="Main" className={styles.nav}>
              {data.nav.map((n) => {
                const on = pathname === n.href || pathname.startsWith(`${n.href}/`);
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    aria-current={on ? 'page' : undefined}
                    className={[styles.navItem, on && styles.navItemOn].filter(Boolean).join(' ')}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>

            <div className={styles.foot}>
              <a
                className={styles.footLink}
                href={`/book/${data.tenant.slug}${data.tenant.pageStatus === 'PUBLISHED' ? '' : '?preview=1'}`}
                target="_blank"
                rel="noopener"
              >
                View booking page ↗
              </a>
              {data.user.isPlatformAdmin ? (
                <Link className={styles.footLink} href="/super-admin">
                  Platform admin ↗
                </Link>
              ) : null}
              <form action={logoutAction}>
                <button type="submit" className={styles.footLink}>
                  Sign out
                </button>
              </form>
              <div className={styles.user}>
                <span className={styles.userAvatar} aria-hidden="true">
                  {data.user.initials}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className={styles.userName}>{data.user.name}</span>
                  <span className={styles.userRole}>{data.user.roleLabel}</span>
                </span>
              </div>
            </div>
          </aside>
          {navOpen ? (
            <div className={styles.overlay} onClick={() => setNavOpen(false)} aria-hidden="true" />
          ) : null}

          <main className={styles.main}>{children}</main>
        </div>
        <Suspense fallback={null}>
          <AppointmentDrawer />
        </Suspense>
        {data.booking ? (
          <NewAppointmentModal
            key={newAppt.n}
            open={newAppt.open}
            prefill={newAppt.prefill}
            onClose={() => setNewAppt((s) => ({ ...s, open: false }))}
          />
        ) : null}
      </ToastProvider>
    </Ctx.Provider>
  );
}

/** Sticky page header with title, subtitle, optional controls and "+ New appointment". */
export function PageHeader({
  title,
  sub,
  children,
  hideNew,
}: {
  title: string;
  sub?: ReactNode;
  children?: ReactNode;
  hideNew?: boolean;
}) {
  const { data, openNav, openNewAppointment } = useShell();
  return (
    <header className={styles.header}>
      <button type="button" className={styles.menuButton} aria-label="Open menu" onClick={openNav}>
        ☰
      </button>
      <div className={styles.titleBlock}>
        <h1 className={styles.h1}>{title}</h1>
        {sub ? <span className={styles.sub}>{sub}</span> : null}
      </div>
      {children}
      {data.booking && !hideNew ? (
        <button
          type="button"
          onClick={() => openNewAppointment()}
          style={{
            appearance: 'none',
            border: 0,
            background: '#1c1a17',
            color: '#fff',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 13,
            whiteSpace: 'nowrap',
          }}
        >
          + New appointment
        </button>
      ) : null}
    </header>
  );
}

export function PageContent({ children }: { children: ReactNode }) {
  return <div className={styles.content}>{children}</div>;
}

export const shellStyles = styles;
