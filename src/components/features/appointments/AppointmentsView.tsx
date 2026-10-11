'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Segmented } from '@/components/ui/Segmented';
import { StatusPill } from '@/components/ui/StatusPill';
import tbl from '@/components/ui/Table.module.scss';
import { fmtDay, fmtTime, moneyFmt } from '@/components/features/shared/format';
import { useOpenAppointment } from './AppointmentDrawer';
import { useI18n } from '@/i18n/client';

type Status = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface ApptRowView {
  id: string;
  ref: string;
  customer: string;
  service: string;
  staff: string;
  startAt: string;
  durationMin: number;
  priceMinor: number;
  currency: string;
  status: Status;
  source: 'ONLINE' | 'PHONE' | 'WALK_IN';
  collectedMinor: number;
  /** A SINPE deposit is waiting for staff to verify it. */
  depositToCheck: boolean;
}

const CHIPS: (Status | null)[] = [
  null,
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

export function AppointmentsView({
  rows,
  total,
  hasMore,
  counts,
  filters,
  staff,
  showPayments,
}: {
  rows: ApptRowView[];
  total: number;
  hasMore: boolean;
  counts: Partial<Record<Status, number>>;
  filters: {
    scope: string;
    status: Status | null;
    q: string;
    staffId: string | null;
    limit: number;
  };
  staff: { id: string; name: string }[];
  showPayments: boolean;
}) {
  const { data } = useShell();
  const tz = data.tenant.timezone;
  const base = `/app/${data.tenant.slug}/appointments`;
  const router = useRouter();
  const openAppt = useOpenAppointment();
  const [q, setQ] = useState(filters.q);
  const { t, locale } = useI18n();
  const al = t.appointments.list;
  const money = (minor: number, currency: string) => moneyFmt(minor, currency, locale);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | null> = {
      when: filters.scope === 'upcoming' ? null : filters.scope,
      status: filters.status,
      q: filters.q || null,
      staff: filters.staffId,
      ...patch,
    };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  useEffect(() => {
    if (q === filters.q) return;
    const id = setTimeout(
      () => router.replace(href({ q: q.trim() || null, limit: null }), { scroll: false }),
      300,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const allCount = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <>
      <PageHeader
        title={t.app.nav.appointments}
        sub={al.sub({
          business: data.tenant.name,
          zone: tz.split('/').pop()?.replace(/_/g, ' ') ?? tz,
        })}
      />
      <PageContent>
        <div className={tbl.toolbar}>
          <input
            className={tbl.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={al.search}
            aria-label={al.searchLabel}
          />
          <Segmented
            label={al.when}
            items={(['upcoming', 'past', 'all'] as const).map((k) => ({
              key: k,
              label: al.scopes[k],
              selected: filters.scope === k,
              href: href({ when: k === 'upcoming' ? null : k, limit: null }),
            }))}
          />
          <select
            className={tbl.select}
            aria-label={al.staff}
            value={filters.staffId ?? 'all'}
            onChange={(e) =>
              router.replace(
                href({ staff: e.target.value === 'all' ? null : e.target.value, limit: null }),
                { scroll: false },
              )
            }
          >
            <option value="all">{al.allStaff}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className={tbl.chips}>
          {CHIPS.map((k) => (
            <Link
              key={k ?? 'all'}
              scroll={false}
              href={href({ status: k, limit: null })}
              aria-current={filters.status === k ? 'true' : undefined}
              className={[tbl.chip, filters.status === k && tbl.chipOn].filter(Boolean).join(' ')}
            >
              {k ? t.common.status[k] : al.all} <span>{k ? (counts[k] ?? 0) : allCount}</span>
            </Link>
          ))}
        </div>
        <div className={tbl.wrap}>
          <table className={tbl.table} style={{ minWidth: 940 }}>
            <thead>
              <tr>
                <th>{al.cols.id}</th>
                <th>{al.cols.customer}</th>
                <th>{al.cols.service}</th>
                <th>{al.cols.staff}</th>
                <th>{al.cols.when}</th>
                <th>{al.cols.duration}</th>
                <th className={tbl.right}>{al.cols.price}</th>
                <th>{al.cols.status}</th>
                <th>{al.cols.source}</th>
                {showPayments ? <th>{al.cols.payment}</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={tbl.clickable}
                  tabIndex={0}
                  onClick={() => openAppt(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openAppt(r.id);
                    }
                  }}
                >
                  <td className={tbl.mono}>{r.ref}</td>
                  <td className={tbl.strong}>{r.customer}</td>
                  <td>{r.service}</td>
                  <td>{r.staff}</td>
                  <td className={tbl.nowrap}>
                    {fmtDay(r.startAt, tz, locale)} · {fmtTime(r.startAt, tz, locale)}
                  </td>
                  <td>
                    {r.durationMin} {t.appointments.min}
                  </td>
                  <td className={tbl.right}>
                    {r.priceMinor === 0 ? t.appointments.free : money(r.priceMinor, r.currency)}
                  </td>
                  <td>
                    <StatusPill status={r.status} size="sm" />
                    {r.depositToCheck ? (
                      <div
                        style={{ fontSize: 11, fontWeight: 700, color: '#a3570f', marginTop: 4 }}
                      >
                        {al.depositToCheck}
                      </div>
                    ) : null}
                  </td>
                  <td className={tbl.muted}>{al.source[r.source]}</td>
                  {showPayments ? (
                    <td className={r.collectedMinor > 0 ? undefined : tbl.faint}>
                      {r.collectedMinor <= 0
                        ? al.notRecorded
                        : r.collectedMinor >= r.priceMinor
                          ? al.collected({ amount: money(r.collectedMinor, r.currency) })
                          : al.partOf({
                              amount: money(r.collectedMinor, r.currency),
                              total: money(r.priceMinor, r.currency),
                            })}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <div className={tbl.empty}>
              {al.noMatch}{' '}
              <Link className={tbl.linkBtn} href={base} scroll={false} onClick={() => setQ('')}>
                {al.clearFilters}
              </Link>
            </div>
          ) : null}
        </div>
        <div className={tbl.footer}>
          <span>{al.showing({ n: rows.length, total })}</span>
          {hasMore ? (
            <Link
              className={tbl.chip}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13 }}
              href={href({ limit: String(filters.limit + 30) })}
              scroll={false}
            >
              {al.showMore}
            </Link>
          ) : null}
        </div>
      </PageContent>
    </>
  );
}
