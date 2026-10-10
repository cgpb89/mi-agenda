'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import styles from './Dialog.module.scss';

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

/** Single toast at the bottom centre, auto-hides after 2.6 s (per design). */
export function ToastProvider({ children, platform }: { children: ReactNode; platform?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback<ShowToast>((m) => {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status">
        {message ? (
          <div
            className={[styles.toast, platform && styles.toastPlatform].filter(Boolean).join(' ')}
          >
            {message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
