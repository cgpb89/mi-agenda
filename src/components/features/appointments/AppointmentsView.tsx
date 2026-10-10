'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { Segmented } from '@/components/ui/Segmented';
import { StatusPill } from '@/components/ui/StatusPill';
import t from '@/components/ui/Table.module.scss';
import { fmtDay, fmtTime, moneyFmt } from '@/components/features/shared/format';
import { useOpenAppointment } from './AppointmentDrawer';

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
}

const SOURCE = { ONLINE: 'Online', PHONE: 'Phone', WALK_IN: 'Walk-in' } as const;
const CHIPS: [Status | null, string][] = [
  [null, 'All'],
  ['PENDING', 'Pending'],
  ['CONFIRMED', 'Confirmed'],
  ['COMPLETED', 'Completed'],
  ['CANCELLED', 'Cancelled'],
  ['NO_SHOW', 'No-show'],
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
        title="Appointments"
        sub={`${data.tenant.name} · ${tz.split('/').pop()?.replace(/_/g, ' ')} time`}
      />
      <PageContent>
        <div className={t.toolbar}>
          <input
            className={t.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer, service or ID"
            aria-label="Search appointments"
          />
          <Segmented
            label="When"
            items={[
              ['upcoming', 'Upcoming'],
              ['past', 'Past'],
              ['all', 'All'],
            ].map(([k, l]) => ({
              key: k!,
              label: l,
              selected: filters.scope === k,
              href: href({ when: k === 'upcoming' ? null : k!, limit: null }),
            }))}
          />
          <select
            className={t.select}
            aria-label="Staff"
            value={filters.staffId ?? 'all'}
            onChange={(e) =>
              router.replace(
                href({ staff: e.target.value === 'all' ? null : e.target.value, limit: null }),
                { scroll: false },
              )
            }
          >
            <option value="all">All staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className={t.chips}>
          {CHIPS.map(([k, label]) => (
            <Link
              key={label}
              scroll={false}
              href={href({ status: k, limit: null })}
              aria-current={filters.status === k ? 'true' : undefined}
              className={[t.chip, filters.status === k && t.chipOn].filter(Boolean).join(' ')}
            >
              {label} <span>{k ? (counts[k] ?? 0) : allCount}</span>
            </Link>
          ))}
        </div>
        <div className={t.wrap}>
          <table className={t.table} style={{ minWidth: 940 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Staff</th>
                <th>Date &amp; time</th>
                <th>Duration</th>
                <th className={t.right}>Price</th>
                <th>Status</th>
                <th>Source</th>
                {showPayments ? <th>Payment</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={t.clickable}
                  tabIndex={0}
                  onClick={() => openAppt(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openAppt(r.id);
                    }
                  }}
                >
                  <td className={t.mono}>{r.ref}</td>
                  <td className={t.strong}>{r.customer}</td>
                  <td>{r.service}</td>
                  <td>{r.staff}</td>
                  <td className={t.nowrap}>
                    {fmtDay(r.startAt, tz)} · {fmtTime(r.startAt, tz)}
                  </td>
                  <td>{r.durationMin} min</td>
                  <td className={t.right}>
                    {r.priceMinor === 0 ? 'Free' : moneyFmt(r.priceMinor, r.currency)}
                  </td>
                  <td>
                    <StatusPill status={r.status} size="sm" />
                  </td>
                  <td className={t.muted}>{SOURCE[r.source]}</td>
                  {showPayments ? (
                    <td className={r.collectedMinor > 0 ? undefined : t.faint}>
                      {r.collectedMinor <= 0
                        ? 'Not recorded'
                        : r.collectedMinor >= r.priceMinor
                          ? `${moneyFmt(r.collectedMinor, r.currency)} collected`
                          : `${moneyFmt(r.collectedMinor, r.currency)} of ${moneyFmt(r.priceMinor, r.currency)}`}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <div className={t.empty}>
              No appointments match these filters.{' '}
              <Link className={t.linkBtn} href={base} scroll={false} onClick={() => setQ('')}>
                Clear filters
              </Link>
            </div>
          ) : null}
        </div>
        <div className={t.footer}>
          <span>
            Showing {rows.length} of {total} · Payment shows money recorded as collected
          </span>
          {hasMore ? (
            <Link
              className={t.chip}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13 }}
              href={href({ limit: String(filters.limit + 30) })}
              scroll={false}
            >
              Show 30 more
            </Link>
          ) : null}
        </div>
      </PageContent>
    </>
  );
}
