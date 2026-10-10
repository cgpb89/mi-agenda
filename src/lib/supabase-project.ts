/**
 * Helpers to identify which Supabase project a URL belongs to, so we can
 * verify that the Postgres connection strings and NEXT_PUBLIC_SUPABASE_URL
 * point at the same project. Pure (no secrets are returned or logged).
 */

/** https://<ref>.supabase.co → <ref> */
export function projectRefFromApiUrl(apiUrl: string | undefined): string | null {
  if (!apiUrl) return null;
  try {
    const m = /^([a-z0-9]+)\.supabase\.co$/.exec(new URL(apiUrl).hostname);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Postgres URL → project ref:
 *  - pooler:  postgresql://<role>.<ref>:pw@aws-0-<region>.pooler.supabase.com:6543/postgres
 *  - direct:  postgresql://postgres:pw@db.<ref>.supabase.co:5432/postgres
 */
export function projectRefFromDbUrl(dbUrl: string | undefined): string | null {
  if (!dbUrl) return null;
  try {
    const u = new URL(dbUrl);
    const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(u.hostname)?.[1];
    if (direct) return direct;
    if (u.hostname.endsWith('.pooler.supabase.com')) {
      const user = decodeURIComponent(u.username);
      return user.includes('.') ? (user.split('.').pop() ?? null) : null;
    }
    return null;
  } catch {
    return null;
  }
}
