'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import tbl from '@/components/ui/Table.module.scss';
import { fmtDay, moneyFmt } from '@/components/features/shared/format';
import { useI18n } from '@/i18n/client';

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
  const { t, locale } = useI18n();
  const cu = t.customers;

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
      <PageHeader title={t.app.nav.customers} sub={cu.sub({ n: total })} />
      <PageContent>
        <div className={tbl.toolbar}>
          <input
            className={tbl.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={cu.search}
            aria-label={cu.searchLabel}
          />
        </div>
        <div className={tbl.wrap}>
          <table className={tbl.table} style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>{cu.cols.customer}</th>
                <th>{cu.cols.phone}</th>
                <th>{cu.cols.email}</th>
                <th>{cu.cols.completed}</th>
                <th>{cu.cols.last}</th>
                <th>{cu.cols.next}</th>
                <th className={tbl.right}>{cu.cols.value}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={tbl.clickable}
                  tabIndex={0}
                  onClick={() => router.push(`${base}/${r.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`${base}/${r.id}`)}
                >
                  <td className={tbl.strong}>{r.name}</td>
                  <td className={tbl.nowrap}>{r.phone || <span className={tbl.faint}>—</span>}</td>
                  <td className={tbl.muted}>{r.email || <span className={tbl.faint}>—</span>}</td>
                  <td className={tbl.mono}>{r.completed}</td>
                  <td className={tbl.nowrap}>
                    {r.lastVisit
                      ? fmtDay(r.lastVisit, tz, locale, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className={tbl.nowrap}>
                    {r.nextVisit ? fmtDay(r.nextVisit, tz, locale) : '—'}
                  </td>
                  <td className={tbl.right}>{moneyFmt(r.valueMinor, currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <div className={tbl.empty}>{q ? cu.noMatch : cu.emptyList}</div>
          ) : null}
        </div>
        <div className={tbl.footer}>
          <span>{cu.showing({ n: rows.length, total })}</span>
          {rows.length < total ? (
            <Link
              className={tbl.chip}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13 }}
              href={`${base}?${new URLSearchParams({ ...(q ? { q } : {}), limit: String(limit + 50) })}`}
              scroll={false}
            >
              {cu.showMore}
            </Link>
          ) : null}
        </div>
      </PageContent>
    </>
  );
}
