'use client';

import { useState, useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/** The viewer's IANA time zone; 'UTC' during server rendering. */
export function useBrowserTimeZone(fallback = 'UTC'): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
}

/** A stable "now" captured once per mount (keeps render pure). */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}
