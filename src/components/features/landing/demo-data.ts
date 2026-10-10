import type { TemplateKey } from '@/components/features/booking/themes';

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

function svc(prefix: string, staff: string[], list: [string, number, number, string][]) {
  return list.map(([name, dur, price, desc], i) => ({
    id: `${prefix}-s${i}`,
    name,
    description: desc,
    durationMin: dur,
    priceMinor: price * 100,
    staffIds: staff,
  }));
}

function people(prefix: string, list: [string, string][]) {
  return list.map(([name, title], i) => ({ id: `${prefix}-p${i}`, name, title }));
}

const barberStaff = people('b', [
  ['Marcus Reed', 'Senior barber'],
  ['Theo Alvarez', 'Barber'],
  ['Jun Park', 'Barber & colourist'],
]);
const wellStaff = people('w', [
  ['Amara Lind', 'Lead aesthetician'],
  ['Noor Haddad', 'Massage therapist'],
]);
const consultStaff = people('c', [
  ['Dr. Elena Ruiz', 'Physiotherapist'],
  ['Samuel Achebe', 'Sports physiotherapist'],
]);
const fitStaff = people('f', [
  ['Kai Morgan', 'Strength coach'],
  ['Priya Shah', 'Conditioning coach'],
]);
const servStaff = people('s', [
  ['Ravi Menon', 'Hardware technician'],
  ['Lena Fischer', 'IT consultant'],
]);

export const DEMO: Record<TemplateKey, DemoBusiness> = {
  barber: {
    name: 'Northside Barber Co.',
    slug: 'northside-barber',
    tz: 'America/New_York',
    open: 540,
    close: 1140,
    brk: [780, 810],
    closed: [0],
    address: '214 Halsey St, Brooklyn, NY',
    policy:
      'Free cancellation up to 4 hours before. Late arrivals over 15 minutes may need to rebook.',
    staff: barberStaff,
    services: svc(
      'b',
      barberStaff.map((p) => p.id),
      [
        ['Classic Cut', 45, 38, 'Scissor and clipper cut, wash and style.'],
        ['Skin Fade', 60, 45, 'Tight fade blended to your length on top.'],
        ['Beard Trim', 30, 22, 'Shape, line-up and hot towel finish.'],
        ['Cut & Beard', 75, 58, 'Full cut with beard shaping.'],
        ['Hot Towel Shave', 45, 40, 'Straight razor shave, two towels.'],
      ],
    ),
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
    policy:
      'Please arrive 10 minutes early. Cancel or move your visit up to 24 hours before at no charge.',
    staff: wellStaff,
    services: svc(
      'w',
      wellStaff.map((p) => p.id),
      [
        ['Signature Facial', 60, 95, 'Cleanse, exfoliation, mask and lymphatic massage.'],
        ['Deep Tissue Massage', 75, 110, 'Slow, focused pressure for tension.'],
        ['Brow Shape & Tint', 30, 38, 'Mapping, shaping and a soft tint.'],
        ['Lash Lift', 45, 72, 'Natural curl that lasts six to eight weeks.'],
      ],
    ),
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
    policy:
      'Please give 24 hours notice to cancel. Video consultations receive a secure link by email before the visit.',
    staff: consultStaff,
    services: svc(
      'c',
      consultStaff.map((p) => p.id),
      [
        ['Initial assessment', 60, 120, 'Full assessment and a written plan. In person.'],
        ['Follow-up session', 30, 70, 'Progress review and treatment. In person.'],
        ['Video consultation', 30, 65, 'Advice and exercise review by video.'],
        ['Workplace ergonomic review', 45, 90, 'Desk and posture review. In person or video.'],
      ],
    ),
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
    policy: 'Cancel up to 12 hours before. Group sessions run with at least 2 people booked.',
    staff: fitStaff,
    services: svc(
      'f',
      fitStaff.map((p) => p.id),
      [
        ['1:1 Strength', 60, 70, 'Coached strength session, programmed for you.'],
        ['Partner Session', 60, 90, 'Train with a friend. Price covers two people.'],
        ['Small Group HIIT', 45, 25, 'Up to 6 people. Conditioning circuit.'],
        ['Movement Assessment', 30, 0, 'First visit. Mobility screen and plan.'],
      ],
    ),
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
    policy: 'Bring your device and charger. Reschedule anytime up to 2 hours before.',
    staff: servStaff,
    services: svc(
      's',
      servStaff.map((p) => p.id),
      [
        ['Laptop diagnostic', 30, 45, 'We find the fault and quote before any work.'],
        ['Screen replacement', 90, 140, 'Most models same day. Parts quoted separately.'],
        ['Data recovery consult', 45, 60, 'Assess drives and recovery options.'],
        ['Home office setup', 120, 180, 'On-site network, printer and desk setup.'],
      ],
    ),
  },
};

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
