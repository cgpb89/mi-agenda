import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './Segmented.module.scss';

export interface SegmentItem {
  key: string;
  label: ReactNode;
  href?: string;
  onSelect?: () => void;
  selected: boolean;
}

/** Segmented control. Items are links (URL state, server-rendered) or buttons. */
export function Segmented({
  items,
  label,
  platform,
}: {
  items: SegmentItem[];
  label: string;
  platform?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={[styles.group, platform && styles.platform].filter(Boolean).join(' ')}
    >
      {items.map((it) => {
        const cls = [styles.item, it.selected && styles.selected].filter(Boolean).join(' ');
        return it.href ? (
          <Link
            key={it.key}
            href={it.href}
            className={cls}
            aria-current={it.selected ? 'true' : undefined}
            scroll={false}
          >
            {it.label}
          </Link>
        ) : (
          <button
            key={it.key}
            type="button"
            className={cls}
            aria-pressed={it.selected}
            onClick={it.onSelect}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  on,
  href,
  onClick,
  children,
  count,
}: {
  on: boolean;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  count?: number;
}) {
  const cls = [styles.chip, on && styles.chipOn].filter(Boolean).join(' ');
  const inner = (
    <>
      {children}
      {count !== undefined ? <span className={styles.count}>{count}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className={cls} aria-current={on ? 'true' : undefined} scroll={false}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} aria-pressed={on} onClick={onClick}>
      {inner}
    </button>
  );
}
