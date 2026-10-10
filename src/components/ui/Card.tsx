import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './Card.module.scss';

export const cardStyles = styles;

export function Card({
  title,
  action,
  children,
  flush,
  className,
}: {
  title?: ReactNode;
  action?: { href: string; label: string } | ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  const actionNode =
    action && typeof action === 'object' && 'href' in action ? (
      <Link className={styles.headLink} href={action.href}>
        {action.label}
      </Link>
    ) : (
      action
    );
  return (
    <section className={[styles.card, className].filter(Boolean).join(' ')}>
      {title ? (
        <div className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          {actionNode}
        </div>
      ) : null}
      <div className={[styles.body, flush && styles.flush].filter(Boolean).join(' ')}>
        {children}
      </div>
    </section>
  );
}

export function EmptyState({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <span className={styles.emptyTitle}>{title}</span>
      {children ? <div className={styles.emptyBody}>{children}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}

export function Kpi({
  label,
  value,
  note,
  muted,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={[styles.kpiValue, muted && styles.kpiValueMuted].filter(Boolean).join(' ')}>
        {value}
      </span>
      {note ? <span className={styles.kpiNote}>{note}</span> : null}
    </div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className={styles.kpiGrid}>{children}</div>;
}
