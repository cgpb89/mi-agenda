'use client';

import { useI18n } from '@/i18n/client';
import styles from './StatusPill.module.scss';

export type AppointmentStatusKey = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export const STATUS_BAR_COLOR: Record<string, string> = {
  PENDING: '#c9a227',
  CONFIRMED: '#e0773a',
  COMPLETED: '#2f6e5a',
  CANCELLED: '#b9b1a4',
  NO_SHOW: '#c4483a',
};

export const STATUS_BG: Record<string, string> = {
  PENDING: '#f6edd0',
  CONFIRMED: '#fbe6d8',
  COMPLETED: '#e3efe9',
  CANCELLED: '#eeebe6',
  NO_SHOW: '#f8dedb',
};

type Status = AppointmentStatusKey | 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CHURNED' | 'INACTIVE';

export function StatusPill({
  status,
  label,
  size,
}: {
  status: Status;
  label?: string;
  size?: 'sm';
}) {
  const { t } = useI18n();
  return (
    <span
      className={[styles.pill, styles[status], size === 'sm' && styles.sm]
        .filter(Boolean)
        .join(' ')}
    >
      {label ?? t.common.status[status]}
    </span>
  );
}
