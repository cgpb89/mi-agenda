'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import t from '@/components/ui/Table.module.scss';
import { fmtDay, moneyFmt } from '@/components/features/shared/format';

interface Row {
  id: string;
  name: string;
  phone: string;
  email: string;
  completed: number;
  valueMinor: number;
  lastVisit: string | null;
  nextVisit: string | null;
}

export function CustomersView({
  rows,
  total,
  q,
  limit,
}: {
  rows: Row[];
  total: number;
  q: string;
  limit: number;
}) {
  const { data } = useShell();
  const { slug, timezone: tz, currency } = data.tenant;
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const base = `/app/${slug}/customers`;

  useEffect(() => {
    if (query === q) return;
    const id = setTimeout(
      () =>
        router.replace(query.trim() ? `${base}?q=${encodeURIComponent(query.trim())}` : base, {
          scroll: false,
        }),
      300,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <>
      <PageHeader
        title="Customers"
        sub={`${total} customer${total === 1 ? '' : 's'} · phone numbers are not verified`}
      />
      <PageContent>
        <div className={t.toolbar}>
          <input
            className={t.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or phone"
            aria-label="Search customers"
          />
        </div>
        <div className={t.wrap}>
          <table className={t.table} style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Completed visits</th>
                <th>Last visit</th>
                <th>Next visit</th>
                <th className={t.right}>Est. lifetime value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={t.clickable}
                  tabIndex={0}
                  onClick={() => router.push(`${base}/${r.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`${base}/${r.id}`)}
                >
                  <td className={t.strong}>{r.name}</td>
                  <td className={t.nowrap}>{r.phone || <span className={t.faint}>—</span>}</td>
                  <td className={t.muted}>{r.email || <span className={t.faint}>—</span>}</td>
                  <td className={t.mono}>{r.completed}</td>
                  <td className={t.nowrap}>
                    {r.lastVisit
                      ? fmtDay(r.lastVisit, tz, { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className={t.nowrap}>{r.nextVisit ? fmtDay(r.nextVisit, tz) : '—'}</td>
                  <td className={t.right}>{moneyFmt(r.valueMinor, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <div className={t.empty}>
              {q
                ? 'No customers match that search.'
                : 'Customers appear here after their first booking.'}
            </div>
          ) : null}
        </div>
        <div className={t.footer}>
          <span>
            Showing {rows.length} of {total} · Lifetime value is the price of completed
            appointments, not payments.
          </span>
          {rows.length < total ? (
            <Link
              className={t.chip}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13 }}
              href={`${base}?${new URLSearchParams({ ...(q ? { q } : {}), limit: String(limit + 50) })}`}
              scroll={false}
            >
              Show 50 more
            </Link>
          ) : null}
        </div>
      </PageContent>
    </>
  );
}
