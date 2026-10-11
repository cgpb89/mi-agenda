import type { TemplateKey } from '@/components/features/booking/themes';
import type { Locale } from '@/i18n/config';
import { messages } from '@/i18n/messages';

/**
 * Marketing demo data (design: Booking Flow.dc.html `B`). Used ONLY by the
 * landing page's template switcher, which runs BookingFlow in demo mode with
 * local fake availability and never calls the booking API.
 */
export interface DemoBusiness {
  name: string;
  slug: string;
  tz: string;
  open: number;
  close: number;
  brk: [number, number];
  closed: number[]; // JS getDay(): 0 = Sunday
  address: string;
  policy: string;
  services: {
    id: string;
    name: string;
    description: string;
    durationMin: number;
    priceMinor: number;
    staffIds: string[];
  }[];
  staff: { id: string; name: string; title: string }[];
}

interface DemoBase {
  name: string;
  slug: string;
  tz: string;
  open: number;
  close: number;
  brk: [number, number];
  closed: number[];
  address: string;
  /** Proper nouns; titles come from the dictionary in the same order. */
  people: string[];
  /** [durationMin, price] per service; names come from the dictionary in the same order. */
  prices: [number, number][];
}

const BASE: Record<TemplateKey, DemoBase> = {
  barber: {
    name: 'Northside Barber Co.',
    slug: 'northside-barber',
    tz: 'America/New_York',
    open: 540,
    close: 1140,
    brk: [780, 810],
    closed: [0],
    address: '214 Halsey St, Brooklyn, NY',
    people: ['Marcus Reed', 'Theo Alvarez', 'Jun Park'],
    prices: [
      [45, 38],
      [60, 45],
      [30, 22],
      [75, 58],
      [45, 40],
    ],
  },
  wellness: {
    name: 'Sable & Sage Studio',
    slug: 'sable-and-sage',
    tz: 'America/Los_Angeles',
    open: 600,
    close: 1140,
    brk: [810, 840],
    closed: [0, 1],
    address: '88 Alder Lane, Portland, OR',
    people: ['Amara Lind', 'Noor Haddad'],
    prices: [
      [60, 95],
      [75, 110],
      [30, 38],
      [45, 72],
    ],
  },
  consult: {
    name: 'Harbor Physio & Consulting',
    slug: 'harbor-physio',
    tz: 'America/Chicago',
    open: 480,
    close: 1050,
    brk: [750, 780],
    closed: [0, 6],
    address: '1200 Lakeview Ave, Suite 4, Chicago, IL',
    people: ['Dr. Elena Ruiz', 'Samuel Achebe'],
    prices: [
      [60, 120],
      [30, 70],
      [30, 65],
      [45, 90],
    ],
  },
  fitness: {
    name: 'Forge Training Lab',
    slug: 'forge-training-lab',
    tz: 'America/Denver',
    open: 420,
    close: 1200,
    brk: [780, 840],
    closed: [0],
    address: '47 Foundry Rd, Denver, CO',
    people: ['Kai Morgan', 'Priya Shah'],
    prices: [
      [60, 70],
      [60, 90],
      [45, 25],
      [30, 0],
    ],
  },
  services: {
    name: 'Mendwell Repair & Advisory',
    slug: 'mendwell',
    tz: 'America/New_York',
    open: 540,
    close: 1080,
    brk: [750, 780],
    closed: [0],
    address: '31 Mercer St, Jersey City, NJ',
    people: ['Ravi Menon', 'Lena Fischer'],
    prices: [
      [30, 45],
      [90, 140],
      [45, 60],
      [120, 180],
    ],
  },
};

const PREFIX: Record<TemplateKey, string> = {
  barber: 'b',
  wellness: 'w',
  consult: 'c',
  fitness: 'f',
  services: 's',
};

const cache = new Map<Locale, Record<TemplateKey, DemoBusiness>>();

/** Demo businesses with their text in `locale`. */
export function demoFor(locale: Locale): Record<TemplateKey, DemoBusiness> {
  const hit = cache.get(locale);
  if (hit) return hit;
  const text = messages[locale].landing.demo;
  const out = {} as Record<TemplateKey, DemoBusiness>;
  for (const key of Object.keys(BASE) as TemplateKey[]) {
    const { people, prices, ...base } = BASE[key];
    const p = PREFIX[key];
    const staff = people.map((name, i) => ({
      id: `${p}-p${i}`,
      name,
      title: text[key].staffTitles[i] ?? '',
    }));
    out[key] = {
      ...base,
      policy: text[key].policy,
      staff,
      services: prices.map(([durationMin, price], i) => ({
        id: `${p}-s${i}`,
        name: text[key].services[i]?.[0] ?? '',
        description: text[key].services[i]?.[1] ?? '',
        durationMin,
        priceMinor: price * 100,
        staffIds: staff.map((x) => x.id),
      })),
    };
  }
  cache.set(locale, out);
  return out;
}

/** Deterministic fake bookings (same idea as the prototype's `booked()`). */
function booked(dayIdx: number, m: number, staffIdx: number) {
  return ((dayIdx + 3) * 7919 + m * 31 + (staffIdx + 2) * 104729) % 97 < 30;
}

export function demoAvailability(
  b: DemoBusiness,
  durationMin: number,
  staffSel: string,
  date: string | null,
) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const staffIdx = staffSel === 'any' ? -1 : b.staff.findIndex((s) => s.id === staffSel);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const okFor = (d: number, m: number, s: number) => {
    if (m + durationMin > b.close) return false;
    if (m < b.brk[1] && m + durationMin > b.brk[0]) return false;
    if (d === 0 && m < nowMin + 60) return false;
    for (let k = m; k < m + durationMin; k += 30) if (booked(d, k, s)) return false;
    return true;
  };
  const ok = (d: number, m: number) =>
    staffIdx >= 0 ? okFor(d, m, staffIdx) : b.staff.some((_, i) => okFor(d, m, i));
  const slotsFor = (d: number) => {
    const day = new Date(today);
    day.setDate(today.getDate() + d);
    if (b.closed.includes(day.getDay())) return null;
    const out: { startMin: number; available: boolean }[] = [];
    for (let m = b.open; m + durationMin <= b.close; m += 30)
      out.push({ startMin: m, available: ok(d, m) });
    return out;
  };
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const sl = slotsFor(i);
    return {
      date: iso(d),
      status: (!sl ? 'closed' : sl.some((x) => x.available) ? 'open' : 'full') as
        'open' | 'full' | 'closed',
    };
  });
  const sel = date ?? days.find((d) => d.status === 'open')?.date ?? days[0]!.date;
  const idx = days.findIndex((d) => d.date === sel);
  return { today: days[0]!.date, date: sel, days, slots: slotsFor(Math.max(0, idx)) };
}
