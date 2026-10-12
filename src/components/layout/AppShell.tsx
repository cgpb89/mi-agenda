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
  useSyncExternalStore,
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
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { useI18n } from '@/i18n/client';
import { RENEWAL_REMINDER_DAYS } from '@/modules/billing/access';
import { TourGuide } from '@/components/features/tour/TourGuide';
import type { MembershipRole } from '@/lib/auth/permissions';
import { stepsFor, type TourId } from '@/modules/tour/steps';

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
  /** Trial / paid period. Dates are pre-formatted in the business's timezone. */
  billing: {
    phase: 'trial' | 'paid' | 'closed';
    daysLeft: number;
    accessUntil: string;
    supportEmail: string | null;
    /** Link to the owner billing page (owners only). */
    billingHref: string | null;
  };
  /** Guided setup tour for this user's role, and where they left it. */
  tour: { id: TourId; role: MembershipRole; step: number; done: boolean };
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

const noopSubscribe = () => () => {};

export function AppShell({ data, children }: { data: ShellData; children: ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const [newAppt, setNewAppt] = useState<{
    open: boolean;
    prefill?: NewAppointmentPrefill;
    n: number;
  }>({ open: false, n: 0 });

  // Guided tour: starts by itself until finished or skipped; replayable from the sidebar.
  const [tour, setTour] = useState({ open: !data.tour.done, start: data.tour.step, n: 0 });
  // The tour renders into document.body, so only on the client.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

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
  const { t } = useI18n();

  return (
    <Ctx.Provider value={ctx}>
      <ToastProvider>
        <div className={styles.root}>
          <aside
            className={[styles.side, navOpen && styles.sideOpen].filter(Boolean).join(' ')}
            aria-label={t.app.sidebar}
          >
            <div className={styles.brandRow}>
              <Link href="/" className={styles.logo} aria-label={t.common.homeLabel}>
                tempo<span>.</span>
              </Link>
              <button
                type="button"
                className={styles.closeNav}
                aria-label={t.app.closeMenu}
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

            <nav aria-label={t.app.mainNav} className={styles.nav} data-tour="sidebar">
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
                {t.app.viewBookingPage}
              </a>
              {data.user.isPlatformAdmin ? (
                <Link className={styles.footLink} href="/super-admin">
                  {t.app.platformAdmin}
                </Link>
              ) : null}
              <button
                type="button"
                className={styles.footLink}
                onClick={() => {
                  setNavOpen(false);
                  setTour((s) => ({ open: true, start: 0, n: s.n + 1 }));
                }}
              >
                {t.app.tour.replay}
              </button>
              <div className={styles.footRow}>
                <form action={logoutAction}>
                  <button type="submit" className={styles.footLink}>
                    {t.app.signOut}
                  </button>
                </form>
                <LocaleSwitcher />
              </div>
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

          <main className={styles.main}>
            <AccessBanner billing={data.billing} />
            {children}
          </main>
        </div>
        <Suspense fallback={null}>
          <AppointmentDrawer />
        </Suspense>
        {mounted && tour.open ? (
          <TourGuide
            key={`tour-${tour.n}`}
            tour={data.tour.id}
            steps={stepsFor(data.tour.id, data.tour.role)}
            slug={data.tenant.slug}
            initialStep={tour.start}
            onClose={() => setTour((s) => ({ ...s, open: false }))}
          />
        ) : null}
        {data.booking ? (
          <NewAppointmentModal
            key={`appt-${newAppt.n}`}
            open={newAppt.open}
            prefill={newAppt.prefill}
            onClose={() => setNewAppt((s) => ({ ...s, open: false }))}
          />
        ) : null}
      </ToastProvider>
    </Ctx.Provider>
  );
}

/**
 * Trial countdown (always during the trial) and renewal reminder (last days of
 * a paid period). A closed store gets the full "closed" screen instead.
 */
function AccessBanner({ billing }: { billing: ShellData['billing'] }) {
  const { t } = useI18n();
  const b = t.app.billing;
  const show =
    billing.phase === 'trial' ||
    (billing.phase === 'paid' && billing.daysLeft <= RENEWAL_REMINDER_DAYS);
  if (!show) return null;
  const urgent = billing.daysLeft <= RENEWAL_REMINDER_DAYS;
  return (
    <div
      className={[styles.access, urgent && styles.accessUrgent].filter(Boolean).join(' ')}
      role="status"
    >
      <strong>
        {billing.phase === 'trial'
          ? b.trialDays({ n: billing.daysLeft })
          : b.renewDays({ n: billing.daysLeft })}
      </strong>
      <span>
        {billing.phase === 'trial'
          ? b.trialEnds({ date: billing.accessUntil })
          : b.renewEnds({ date: billing.accessUntil })}
      </span>
      {billing.billingHref ? (
        <Link href={billing.billingHref}>{t.app.billingPage.seeBilling}</Link>
      ) : billing.supportEmail ? (
        <a href={`mailto:${billing.supportEmail}`}>{b.contact}</a>
      ) : null}
    </div>
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
  const { t } = useI18n();
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label={t.app.openMenu}
        onClick={openNav}
      >
        ☰
      </button>
      <div className={styles.titleBlock}>
        <h1 className={styles.h1}>{title}</h1>
        {sub ? <span className={styles.sub}>{sub}</span> : null}
      </div>
      {children}
      {data.booking && !hideNew ? (
        <button
          data-tour="new-appointment"
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
          {t.app.newAppointment}
        </button>
      ) : null}
    </header>
  );
}

export function PageContent({ children }: { children: ReactNode }) {
  return <div className={styles.content}>{children}</div>;
}

export const shellStyles = styles;
