import styles from './StatusPill.module.scss';

export const APPOINTMENT_STATUS_LABEL = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
} as const;

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

type Status =
  keyof typeof APPOINTMENT_STATUS_LABEL | 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CHURNED' | 'INACTIVE';

const OTHER_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  TRIAL: 'Trial',
  SUSPENDED: 'Suspended',
  CHURNED: 'Churned',
  INACTIVE: 'Inactive',
};

export function StatusPill({
  status,
  label,
  size,
}: {
  status: Status;
  label?: string;
  size?: 'sm';
}) {
  const text =
    label ??
    (status in APPOINTMENT_STATUS_LABEL
      ? APPOINTMENT_STATUS_LABEL[status as keyof typeof APPOINTMENT_STATUS_LABEL]
      : OTHER_LABEL[status]);
  return (
    <span
      className={[styles.pill, styles[status], size === 'sm' && styles.sm]
        .filter(Boolean)
        .join(' ')}
    >
      {text}
    </span>
  );
}
