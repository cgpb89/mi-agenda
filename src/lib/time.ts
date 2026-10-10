/** Server-side time helpers (keep component bodies free of impure calls). */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function now(): Date {
  return new Date();
}
