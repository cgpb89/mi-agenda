/**
 * Extract a PostgreSQL SQLSTATE / constraint name from errors raised through
 * Prisma + the pg driver adapter, whose wrapping differs between error kinds.
 */
function dig(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

const SQLSTATE = /^[0-9A-Z]{5}$/;

export function pgErrorCode(err: unknown): string | undefined {
  const candidates = [
    dig(err, ['meta', 'driverAdapterError', 'cause', 'originalCode']),
    dig(err, ['cause', 'originalCode']),
    dig(err, ['meta', 'code']),
    dig(err, ['cause', 'code']),
    dig(err, ['code']),
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && SQLSTATE.test(c)) return c;
  }
  return undefined;
}

export function errorText(err: unknown): string {
  const parts: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === 'string') parts.push(v);
  };
  add(dig(err, ['message']));
  add(dig(err, ['meta', 'driverAdapterError', 'cause', 'originalMessage']));
  add(dig(err, ['meta', 'driverAdapterError', 'cause', 'constraint']));
  add(dig(err, ['cause', 'originalMessage']));
  add(dig(err, ['cause', 'constraint']));
  const target = dig(err, ['meta', 'target']);
  if (Array.isArray(target)) parts.push(target.join(','));
  else add(target);
  add(dig(err, ['meta', 'constraint']));
  return parts.join(' | ');
}

export function prismaCode(err: unknown): string | undefined {
  const c = dig(err, ['code']);
  return typeof c === 'string' && /^P\d{4}$/.test(c) ? c : undefined;
}

/** 23P01 exclusion_violation — e.g. overlapping staff appointment. */
export function isExclusionViolation(err: unknown): boolean {
  return (
    pgErrorCode(err) === '23P01' ||
    /exclusion constraint|23P01|no_staff_overlap/i.test(errorText(err))
  );
}

/** 23505 unique_violation / Prisma P2002. */
export function isUniqueViolation(err: unknown, fieldHint?: string): boolean {
  const hit = pgErrorCode(err) === '23505' || prismaCode(err) === 'P2002';
  return hit && (!fieldHint || errorText(err).includes(fieldHint));
}

/** Retryable concurrency failures: serialization failure, deadlock, P2034. */
export function isRetryableTxError(err: unknown): boolean {
  const code = pgErrorCode(err);
  return code === '40001' || code === '40P01' || prismaCode(err) === 'P2034';
}

/** 23514 check_violation. */
export function isCheckViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23514';
}
