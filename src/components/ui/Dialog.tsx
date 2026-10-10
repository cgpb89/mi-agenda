'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.scss';

export const dialogStyles = styles;

interface BaseProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  role?: 'dialog' | 'alertdialog';
}

/**
 * Native <dialog> opened with showModal(): focus is moved inside, the rest of
 * the page is inert, Esc closes, and focus returns to the opener on close.
 */
function NativeDialog({ open, onClose, label, children, className, role = 'dialog' }: BaseProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      className={[styles.dialog, className].filter(Boolean).join(' ')}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}

export function Drawer({
  open,
  onClose,
  label,
  header,
  footer,
  children,
  wide,
}: Omit<BaseProps, 'className' | 'role'> & {
  header: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      label={label}
      className={[styles.drawer, wide && styles.wide].filter(Boolean).join(' ')}
    >
      <div className={styles.drawerHead}>
        <div style={{ minWidth: 0, flex: 1 }}>{header}</div>
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.drawerBody}>{children}</div>
      {footer ? <div className={styles.drawerFoot}>{footer}</div> : null}
    </NativeDialog>
  );
}

export function Modal({
  open,
  onClose,
  title,
  footer,
  children,
}: Omit<BaseProps, 'className' | 'role' | 'label'> & { title: string; footer?: ReactNode }) {
  return (
    <NativeDialog open={open} onClose={onClose} label={title} className={styles.modal}>
      <div className={styles.modalHead}>
        <h2 className={styles.modalTitle}>{title}</h2>
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.modalBody}>{children}</div>
      {footer ? <div className={styles.modalFoot}>{footer}</div> : null}
    </NativeDialog>
  );
}

export function AlertDialog({
  open,
  onClose,
  title,
  children,
  actions,
}: Omit<BaseProps, 'className' | 'role' | 'label'> & { title: string; actions: ReactNode }) {
  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      label={title}
      role="alertdialog"
      className={styles.alert}
    >
      <h2 className={styles.modalTitle}>{title}</h2>
      <div className={styles.alertBody}>{children}</div>
      <div className={styles.alertActions}>{actions}</div>
    </NativeDialog>
  );
}
