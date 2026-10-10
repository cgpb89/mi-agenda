/**
 * Development seed — deterministic and idempotent.
 *
 *   npm run db:seed
 *
 * Creates the five demo businesses from the design (Northside Barber Co. with
 * ~4 months of realistic appointments, plus Sable & Sage, Harbor Physio, Forge
 * Training Lab and Mendwell), a second draft location, and a platform admin.
 *
 * Safety:
 *  - Refuses to run when NODE_ENV=production.
 *  - Never ships a known password: uses SEED_PASSWORD if set, otherwise a
 *    random one printed ONCE to the console.
 *  - Existing tenants (by slug) and users (by email) are left untouched.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { DateTime } from 'luxon';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed: NODE_ENV=production.');
  process.exit(1);
}
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set DIRECT_URL (or DATABASE_URL) to seed.');
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 3 }, { schema: 'app' }),
});
const PASSWORD = process.env.SEED_PASSWORD || randomBytes(12).toString('base64url');
let passwordHash: string;

// Deterministic PRNG (mulberry32) so every seed produces the same data.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function user(email: string, name: string, platformRole: 'NONE' | 'ADMIN' = 'NONE') {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  return db.user.create({ data: { email, name, passwordHash, platformRole } });
}

type Hours = Record<number, [number, number][]>; // ISO weekday → periods

interface TenantSpec {
  slug: string;
  name: string;
  category: 'BARBER' | 'WELLNESS' | 'CONSULT' | 'FITNESS' | 'SERVICES';
  timezone: string;
  owner: { email: string; name: string };
  status?: 'ACTIVE' | 'TRIAL';
  plan?: 'TRIAL' | 'STARTER' | 'GROWTH' | 'BUSINESS';
  published: boolean;
  profile: Omit<
    Prisma.BusinessProfileUncheckedCreateInput,
    'tenantId' | 'template' | 'pageStatus' | 'displayName'
  >;
  policy?: Partial<Prisma.BookingPolicyUncheckedCreateInput>;
  hours: Hours;
  staff: {
    key: string;
    name: string;
    title: string;
    bio?: string;
    hours?: Hours;
    ownerLinked?: boolean;
  }[];
  services: {
    key: string;
    name: string;
    desc: string;
    dur: number;
    price: number;
    bufB?: number;
    bufA?: number;
    staff?: string[];
    active?: boolean;
    online?: boolean;
    availableOn?: 'ALL' | 'WEEKDAYS' | 'SATURDAYS';
    adv?: number;
  }[];
  history?: { days: number; ahead: number; density: number };
}

const split = (a: number, b: number, c: number, d: number): [number, number][] => [
  [a, b],
  [c, d],
];
const H = (h: number, m = 0) => h * 60 + m;

const NORTHSIDE_HOURS: Hours = {
  1: split(H(9), H(13), H(13, 30), H(19)),
  2: split(H(9), H(13), H(13, 30), H(19)),
  3: split(H(9), H(13), H(13, 30), H(19)),
  4: split(H(9), H(13), H(13, 30), H(19)),
  5: split(H(9), H(13), H(13, 30), H(19)),
  6: split(H(9), H(13), H(13, 30), H(18)),
};

const TENANTS: TenantSpec[] = [
  {
    slug: 'northside-barber',
    name: 'Northside Barber Co.',
    category: 'BARBER',
    timezone: 'America/New_York',
    owner: { email: 'marcus@northside.test', name: 'Marcus Reed' },
    status: 'ACTIVE',
    plan: 'GROWTH',
    published: true,
    profile: {
      tagline: 'Brooklyn · Cuts, fades, shaves',
      description: 'Three chairs, no rush. Pick your barber and a time that suits you.',
      phone: '(555) 014-3380',
      address: '214 Halsey St, Brooklyn, NY 11216',
      hoursNote: 'Mon–Sat 9:00 AM – 7:00 PM\nLunch 1:00 – 1:30 PM\nSunday closed',
      pageContent: { eyebrow: 'Brooklyn · Cuts, fades, shaves', headline: 'Northside Barber Co.' },
    },
    policy: {
      policyText:
        'Free cancellation up to 4 hours before. Late arrivals over 15 minutes may need to rebook.',
      cancellationWindowMin: 240,
      maxActiveAppointmentsPerPhone: 2,
    },
    hours: NORTHSIDE_HOURS,
    staff: [
      {
        key: 'mr',
        name: 'Marcus Reed',
        title: 'Senior barber',
        ownerLinked: true,
        hours: {
          1: NORTHSIDE_HOURS[1]!,
          2: NORTHSIDE_HOURS[2]!,
          4: NORTHSIDE_HOURS[4]!,
          5: NORTHSIDE_HOURS[5]!,
          6: NORTHSIDE_HOURS[6]!,
        },
      },
      {
        key: 'ta',
        name: 'Theo Alvarez',
        title: 'Barber',
        hours: {
          1: split(H(10), H(13), H(13, 30), H(19)),
          2: split(H(10), H(13), H(13, 30), H(19)),
          3: split(H(10), H(13), H(13, 30), H(19)),
          4: split(H(10), H(13), H(13, 30), H(19)),
          5: split(H(10), H(13), H(13, 30), H(19)),
          6: split(H(10), H(13), H(13, 30), H(18)),
        },
      },
      {
        key: 'jp',
        name: 'Jun Park',
        title: 'Barber & colourist',
        hours: {
          2: split(H(9), H(13), H(13, 30), H(17)),
          3: split(H(9), H(13), H(13, 30), H(17)),
          4: split(H(9), H(13), H(13, 30), H(17)),
          5: split(H(9), H(13), H(13, 30), H(17)),
          6: split(H(9), H(13), H(13, 30), H(17)),
        },
      },
      {
        key: 'do',
        name: 'Dana Okafor',
        title: 'Barber',
        hours: {
          1: split(H(12), H(15, 30), H(16), H(19)),
          2: split(H(12), H(15, 30), H(16), H(19)),
          3: split(H(12), H(15, 30), H(16), H(19)),
          5: split(H(12), H(15, 30), H(16), H(19)),
          6: [[H(12), H(18)]],
        },
      },
    ],
    services: [
      {
        key: 's1',
        name: 'Classic Cut',
        desc: 'Scissor and clipper cut, wash and style.',
        dur: 45,
        price: 38,
        bufA: 5,
      },
      {
        key: 's2',
        name: 'Skin Fade',
        desc: 'Tight fade blended to your length on top.',
        dur: 60,
        price: 45,
        bufA: 5,
      },
      {
        key: 's3',
        name: 'Beard Trim',
        desc: 'Shape, line-up and hot towel finish.',
        dur: 30,
        price: 22,
      },
      {
        key: 's4',
        name: 'Cut & Beard',
        desc: 'Full cut with beard shaping.',
        dur: 75,
        price: 58,
        bufA: 5,
        staff: ['mr', 'ta', 'jp'],
      },
      {
        key: 's5',
        name: 'Hot Towel Shave',
        desc: 'Straight razor shave, two towels.',
        dur: 45,
        price: 40,
        bufB: 5,
        bufA: 5,
        staff: ['mr', 'ta'],
      },
      {
        key: 's6',
        name: 'Kids Cut',
        desc: 'Under 12s. Quick and patient.',
        dur: 30,
        price: 26,
        staff: ['ta', 'do'],
      },
      {
        key: 's7',
        name: 'Colour Refresh',
        desc: 'Grey blending or a subtle colour.',
        dur: 90,
        price: 85,
        bufA: 10,
        staff: ['jp'],
        active: false,
        online: false,
        availableOn: 'WEEKDAYS',
        adv: 14,
      },
    ],
    history: { days: 90, ahead: 30, density: 0.55 },
  },
  {
    slug: 'sable-and-sage',
    name: 'Sable & Sage Studio',
    category: 'WELLNESS',
    timezone: 'America/Los_Angeles',
    owner: { email: 'amara@sableandsage.test', name: 'Amara Lind' },
    status: 'ACTIVE',
    plan: 'STARTER',
    published: true,
    profile: {
      tagline: 'Skin · Body · Rest',
      email: 'hello@sableandsage.example',
      address: '88 Alder Lane, Portland, OR',
      hoursNote: 'Tuesday – Saturday, 10:00 AM – 7:00 PM',
      pageContent: {
        headline: 'A quieter hour, set aside for you.',
        ctaLabel: 'Book a treatment',
        highlights: [
          { title: 'Face', body: 'Facials and skin consultations, from 60 minutes.' },
          { title: 'Body', body: 'Deep tissue and restorative massage.' },
          { title: 'Brows & lashes', body: 'Shaping, tints and lash lifts.' },
        ],
        notesTitle: 'Before your visit',
        notes: [
          'Arrive ten minutes early to settle in.',
          'Skip retinoids for 48 hours before a facial.',
          'Come with clean, dry lashes for a lift.',
        ],
      },
    },
    policy: {
      policyText:
        'Please arrive 10 minutes early. Cancel or move your visit up to 24 hours before at no charge.',
      cancellationWindowMin: 1440,
    },
    hours: {
      2: split(H(10), H(13, 30), H(14), H(19)),
      3: split(H(10), H(13, 30), H(14), H(19)),
      4: split(H(10), H(13, 30), H(14), H(19)),
      5: split(H(10), H(13, 30), H(14), H(19)),
      6: split(H(10), H(13, 30), H(14), H(19)),
    },
    staff: [
      { key: 'al', name: 'Amara Lind', title: 'Lead aesthetician', ownerLinked: true },
      { key: 'nh', name: 'Noor Haddad', title: 'Massage therapist' },
    ],
    services: [
      {
        key: 'w1',
        name: 'Signature Facial',
        desc: 'Cleanse, exfoliation, mask and lymphatic massage.',
        dur: 60,
        price: 95,
        bufA: 10,
        staff: ['al'],
      },
      {
        key: 'w2',
        name: 'Deep Tissue Massage',
        desc: 'Slow, focused pressure for tension.',
        dur: 75,
        price: 110,
        bufA: 15,
        staff: ['nh'],
      },
      {
        key: 'w3',
        name: 'Brow Shape & Tint',
        desc: 'Mapping, shaping and a soft tint.',
        dur: 30,
        price: 38,
        staff: ['al'],
      },
      {
        key: 'w4',
        name: 'Lash Lift',
        desc: 'Natural curl that lasts six to eight weeks.',
        dur: 45,
        price: 72,
        staff: ['al'],
      },
    ],
    history: { days: 30, ahead: 21, density: 0.4 },
  },
  {
    slug: 'harbor-physio',
    name: 'Harbor Physio & Consulting',
    category: 'CONSULT',
    timezone: 'America/Chicago',
    owner: { email: 'elena@harborphysio.test', name: 'Dr. Elena Ruiz' },
    status: 'ACTIVE',
    plan: 'GROWTH',
    published: true,
    profile: {
      description:
        'See a practitioner in our Lakeview clinic or by secure video. Choose a consultation type and a time below.',
      phone: '(555) 018-7700',
      address: '1200 Lakeview Ave, Suite 4, Chicago, IL',
      hoursNote: 'Mon–Fri 8:00 AM – 5:30 PM',
      pageContent: {
        headline: 'Book a physiotherapy consultation',
        highlights: [
          { title: 'In person', body: '1200 Lakeview Ave, Suite 4, Chicago' },
          { title: 'Video', body: 'Secure link sent by email before your visit' },
          { title: 'Accessibility', body: 'Step-free entrance and lift' },
        ],
        notes: [
          'Give 24 hours notice to cancel or reschedule.',
          'We ask only for contact details when you book. Health history is collected privately at your first visit.',
          'Bring any referral letters or imaging reports.',
        ],
      },
    },
    policy: {
      policyText:
        'Please give 24 hours notice to cancel. Video consultations receive a secure link by email before the visit.',
      cancellationWindowMin: 1440,
      maxActiveAppointmentsPerPhone: 3,
    },
    hours: {
      1: split(H(8), H(12, 30), H(13), H(17, 30)),
      2: split(H(8), H(12, 30), H(13), H(17, 30)),
      3: split(H(8), H(12, 30), H(13), H(17, 30)),
      4: split(H(8), H(12, 30), H(13), H(17, 30)),
      5: split(H(8), H(12, 30), H(13), H(17, 30)),
    },
    staff: [
      {
        key: 'er',
        name: 'Dr. Elena Ruiz',
        title: 'Physiotherapist',
        bio: 'Back and neck pain, post-surgery rehab',
        ownerLinked: true,
      },
      {
        key: 'sa',
        name: 'Samuel Achebe',
        title: 'Sports physiotherapist',
        bio: 'Running injuries, return to sport',
      },
    ],
    services: [
      {
        key: 'c1',
        name: 'Initial assessment',
        desc: 'Full assessment and a written plan. In person.',
        dur: 60,
        price: 120,
        bufA: 10,
      },
      {
        key: 'c2',
        name: 'Follow-up session',
        desc: 'Progress review and treatment. In person.',
        dur: 30,
        price: 70,
      },
      {
        key: 'c3',
        name: 'Video consultation',
        desc: 'Advice and exercise review by video.',
        dur: 30,
        price: 65,
      },
      {
        key: 'c4',
        name: 'Workplace ergonomic review',
        desc: 'Desk and posture review. In person or video.',
        dur: 45,
        price: 90,
      },
    ],
    history: { days: 30, ahead: 21, density: 0.35 },
  },
  {
    slug: 'forge-training-lab',
    name: 'Forge Training Lab',
    category: 'FITNESS',
    timezone: 'America/Denver',
    owner: { email: 'kai@forgelab.test', name: 'Kai Morgan' },
    status: 'TRIAL',
    plan: 'TRIAL',
    published: true,
    profile: {
      description:
        'Coached strength and conditioning in Denver. Book one-to-one, with a partner, or in a small group.',
      address: '47 Foundry Rd',
      hoursNote: 'Mon–Sat 7 AM – 8 PM',
      pageContent: { headline: 'Train with intent.', ctaLabel: 'Book a session' },
    },
    policy: {
      policyText: 'Cancel up to 12 hours before. Group sessions run with at least 2 people booked.',
      cancellationWindowMin: 720,
    },
    hours: Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [d, split(H(7), H(13), H(14), H(20))])),
    staff: [
      { key: 'km', name: 'Kai Morgan', title: 'Strength coach', ownerLinked: true },
      { key: 'ps', name: 'Priya Shah', title: 'Conditioning coach' },
    ],
    services: [
      { key: 'f1', name: '1:1 Strength', desc: 'Programmed for you', dur: 60, price: 70 },
      { key: 'f2', name: 'Partner Session', desc: 'Two people', dur: 60, price: 90 },
      { key: 'f3', name: 'Small Group HIIT', desc: 'Up to 6 people', dur: 45, price: 25 },
      { key: 'f4', name: 'Movement Assessment', desc: 'First visit', dur: 30, price: 0 },
    ],
    history: { days: 14, ahead: 14, density: 0.35 },
  },
  {
    slug: 'mendwell',
    name: 'Mendwell Repair & Advisory',
    category: 'SERVICES',
    timezone: 'America/New_York',
    owner: { email: 'ravi@mendwell.test', name: 'Ravi Menon' },
    status: 'ACTIVE',
    plan: 'STARTER',
    published: true,
    profile: {
      description:
        'Bring your laptop in, or book us for a home office visit. Diagnostics are quoted before any work starts.',
      phone: '(555) 016-4410',
      email: 'desk@mendwell.example',
      address: '31 Mercer St, Jersey City, NJ',
      hoursNote: 'Mon–Sat 9:00 AM – 6:00 PM',
      pageContent: { headline: 'Repairs and IT advice, by appointment.' },
    },
    policy: {
      policyText: 'Bring your device and charger. Reschedule anytime up to 2 hours before.',
      cancellationWindowMin: 120,
    },
    hours: Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((d) => [d, split(H(9), H(12, 30), H(13), H(18))]),
    ),
    staff: [
      { key: 'rm', name: 'Ravi Menon', title: 'Hardware technician', ownerLinked: true },
      { key: 'lf', name: 'Lena Fischer', title: 'IT consultant' },
    ],
    services: [
      {
        key: 'm1',
        name: 'Laptop diagnostic',
        desc: 'We find the fault and quote before any work.',
        dur: 30,
        price: 45,
      },
      {
        key: 'm2',
        name: 'Screen replacement',
        desc: 'Most models same day. Parts quoted separately.',
        dur: 90,
        price: 140,
      },
      {
        key: 'm3',
        name: 'Data recovery consult',
        desc: 'Assess drives and recovery options.',
        dur: 45,
        price: 60,
      },
      {
        key: 'm4',
        name: 'Home office setup',
        desc: 'On-site network, printer and desk setup.',
        dur: 120,
        price: 180,
        staff: ['lf'],
      },
    ],
    history: { days: 21, ahead: 14, density: 0.3 },
  },
  {
    slug: 'northside-eastgate',
    name: 'Northside Eastgate',
    category: 'BARBER',
    timezone: 'America/New_York',
    owner: { email: 'marcus@northside.test', name: 'Marcus Reed' },
    status: 'ACTIVE',
    plan: 'GROWTH',
    published: false,
    profile: {},
    hours: {},
    staff: [{ key: 'mr2', name: 'Marcus Reed', title: 'Owner', ownerLinked: true }],
    services: [],
  },
];

const CUSTOMER_NAMES = [
  'Andre Wallace',
  'Sam Whitfield',
  'Luis Ortega',
  'Ben Carter',
  'Tom Nguyen',
  'Jordan Lee',
  'Chris Patel',
  'Darnell Brooks',
  'Mateo Ruiz',
  'Owen Fischer',
  'Kofi Mensah',
  'Ethan Brooks',
  'Noah Kim',
  'Liam Walsh',
  'Isaac Cohen',
  'Marco Bianchi',
  'Felix Wagner',
  'Hugo Martin',
  'Dev Sharma',
  'Aaron Price',
  'Malik Johnson',
  'Ryan O’Neill',
  'Sergio Alves',
  'Yusuf Demir',
  'Jamal Wright',
  'Leo Rossi',
  'Caleb Turner',
  'Adrian Lopez',
  'Victor Chen',
  'Elliot Grant',
  'Nico Romero',
  'Theo Baker',
  'Simon Park',
  'Rafael Costa',
  'Jonah Reid',
  'Kai Tanaka',
  'Omar Haddad',
  'Gabe Silva',
  'Ivan Petrov',
  'Luca Romano',
];

async function seedTenant(spec: TenantSpec, admin: { id: string }) {
  const existing = await db.tenant.findUnique({ where: { slug: spec.slug } });
  if (existing) {
    console.log(`= ${spec.slug} exists, skipping`);
    return;
  }
  const owner = await user(spec.owner.email, spec.owner.name);
  const tenant = await db.tenant.create({
    data: {
      name: spec.name,
      slug: spec.slug,
      category: spec.category,
      timezone: spec.timezone,
      status: spec.status ?? 'ACTIVE',
      plan: spec.plan ?? 'GROWTH',
      createdAt: DateTime.now()
        .minus({ days: (spec.history?.days ?? 3) + 10 })
        .toJSDate(),
    },
  });
  await db.membership.create({ data: { tenantId: tenant.id, userId: owner.id, role: 'OWNER' } });
  await db.businessProfile.create({
    data: {
      tenantId: tenant.id,
      displayName: spec.name,
      template: spec.category,
      pageStatus: spec.published ? 'PUBLISHED' : 'DRAFT',
      ...spec.profile,
    },
  });
  await db.bookingPolicy.create({
    data: { tenantId: tenant.id, updatedByUserId: owner.id, ...spec.policy },
  });

  const staffIds: Record<string, string> = {};
  for (const [i, s] of spec.staff.entries()) {
    const st = await db.staff.create({
      data: {
        tenantId: tenant.id,
        displayName: s.name,
        title: s.title,
        bio: s.bio,
        sortOrder: i,
        userId: s.ownerLinked ? owner.id : null,
      },
    });
    staffIds[s.key] = st.id;
    if (s.hours) {
      await db.availabilityRule.createMany({
        data: Object.entries(s.hours).flatMap(([d, ps]) =>
          ps.map(([a, b]) => ({
            tenantId: tenant.id,
            staffId: st.id,
            dayOfWeek: Number(d),
            startMin: a,
            endMin: b,
          })),
        ),
      });
    }
  }
  await db.availabilityRule.createMany({
    data: Object.entries(spec.hours).flatMap(([d, ps]) =>
      ps.map(([a, b]) => ({
        tenantId: tenant.id,
        staffId: null,
        dayOfWeek: Number(d),
        startMin: a,
        endMin: b,
      })),
    ),
  });

  const services: {
    id: string;
    dur: number;
    price: number;
    name: string;
    bufB: number;
    bufA: number;
    staff: string[];
    active: boolean;
  }[] = [];
  for (const [i, s] of spec.services.entries()) {
    const svc = await db.service.create({
      data: {
        tenantId: tenant.id,
        name: s.name,
        description: s.desc,
        durationMin: s.dur,
        priceMinor: s.price * 100,
        currency: 'USD',
        bufferBeforeMin: s.bufB ?? 0,
        bufferAfterMin: s.bufA ?? 0,
        isActive: s.active ?? true,
        isOnline: s.online ?? true,
        availableOn: s.availableOn ?? 'ALL',
        maxAdvanceDays: s.adv ?? null,
        sortOrder: i,
      },
    });
    const who = (s.staff ?? spec.staff.map((x) => x.key)).map((k) => staffIds[k]!);
    await db.staffService.createMany({
      data: who.map((staffId) => ({ tenantId: tenant.id, staffId, serviceId: svc.id })),
    });
    services.push({
      id: svc.id,
      dur: s.dur,
      price: s.price * 100,
      name: s.name,
      bufB: s.bufB ?? 0,
      bufA: s.bufA ?? 0,
      staff: who,
      active: s.active ?? true,
    });
  }

  if (spec.slug === 'northside-barber') {
    const today = DateTime.now().setZone(spec.timezone).toISODate()!;
    await db.availabilityException.createMany({
      data: [
        {
          tenantId: tenant.id,
          staffId: null,
          type: 'CLOSED',
          date: new Date(`${DateTime.fromISO(today).year}-11-26T00:00:00Z`),
          reason: 'Thanksgiving',
        },
        {
          tenantId: tenant.id,
          staffId: null,
          type: 'CUSTOM_HOURS',
          date: new Date(`${DateTime.fromISO(today).year}-12-24T00:00:00Z`),
          startMin: H(9),
          endMin: H(14),
          reason: 'Christmas Eve, short day',
        },
        {
          tenantId: tenant.id,
          staffId: staffIds.jp!,
          type: 'BLOCK',
          date: new Date(`${DateTime.fromISO(today).plus({ days: 3 }).toISODate()}T00:00:00Z`),
          startMin: H(9),
          endMin: H(11),
          reason: 'Colour training',
        },
        {
          tenantId: tenant.id,
          staffId: staffIds.do!,
          type: 'BLOCK',
          date: new Date(`${DateTime.fromISO(today).plus({ days: 1 }).toISODate()}T00:00:00Z`),
          startMin: H(16),
          endMin: H(17),
          reason: 'Dentist',
        },
      ],
    });
  }

  if (spec.history && services.length)
    await seedHistory(spec, tenant.id, owner.id, staffIds, services);
  await db.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorUserId: owner.id,
      actorType: 'user',
      action: 'tenant.created',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug: spec.slug },
    },
  });
  void admin;
  console.log(`+ ${spec.slug}`);
}

async function seedHistory(
  spec: TenantSpec,
  tenantId: string,
  ownerId: string,
  staffIds: Record<string, string>,
  services: {
    id: string;
    dur: number;
    price: number;
    name: string;
    bufB: number;
    bufA: number;
    staff: string[];
    active: boolean;
  }[],
) {
  const rand = rng(spec.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const tz = spec.timezone;
  const now = DateTime.now().setZone(tz);
  const customers: { id: string; name: string }[] = [];
  for (const [i, name] of CUSTOMER_NAMES.entries()) {
    const c = await db.customer.create({
      data: {
        tenantId,
        name,
        phoneE164: `+1555${String(100_0000 + i * 7919 + spec.slug.length * 13).slice(-7)}`,
        email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
        createdAt: now.minus({ days: spec.history!.days + 30 - i }).toJSDate(),
      },
    });
    customers.push({ id: c.id, name });
  }

  const appts: Prisma.AppointmentCreateManyInput[] = [];
  const payments: { idx: number; amount: number }[] = [];
  const active = services.filter((s) => s.active);
  for (let off = -spec.history!.days; off <= spec.history!.ahead; off++) {
    const day = now.plus({ days: off }).startOf('day');
    const dow = day.weekday;
    for (const s of spec.staff) {
      const sid = staffIds[s.key]!;
      const periods = (s.hours ?? spec.hours)[dow] ?? [];
      let lastBlockEnd = -Infinity; // minutes from midnight, incl. buffer
      for (const [a, b] of periods) {
        let m = a;
        while (m < b) {
          const offered = active.filter((x) => x.staff.includes(sid));
          if (!offered.length) break;
          const svc = pick(offered);
          if (m + svc.dur > b) break;
          if (m - svc.bufB < lastBlockEnd) {
            m += 15;
            continue;
          }
          if (rand() < spec.history!.density) {
            const start = day.set({ hour: Math.floor(m / 60), minute: m % 60 });
            const end = start.plus({ minutes: svc.dur });
            const past = end < now;
            const r = rand();
            const status = past
              ? r < 0.86
                ? 'COMPLETED'
                : r < 0.93
                  ? 'CANCELLED'
                  : 'NO_SHOW'
              : r < 0.12
                ? 'PENDING'
                : r < 0.95
                  ? 'CONFIRMED'
                  : 'CANCELLED';
            const cust = pick(customers);
            const source = rand() < 0.66 ? 'ONLINE' : rand() < 0.7 ? 'PHONE' : 'WALK_IN';
            appts.push({
              tenantId,
              customerId: cust.id,
              serviceId: svc.id,
              staffId: sid,
              startAt: start.toJSDate(),
              endAt: end.toJSDate(),
              blockStartAt: start.minus({ minutes: svc.bufB }).toJSDate(),
              blockEndAt: end.plus({ minutes: svc.bufA }).toJSDate(),
              status,
              source,
              serviceNameSnapshot: svc.name,
              durationMin: svc.dur,
              quotedPriceMinor: svc.price,
              currency: 'USD',
              contactName: cust.name,
              createdAt: start.minus({ days: 1 + Math.floor(rand() * 10) }).toJSDate(),
              confirmedAt:
                status === 'CONFIRMED' || status === 'COMPLETED'
                  ? start.minus({ days: 1 }).toJSDate()
                  : null,
              completedAt: status === 'COMPLETED' ? end.toJSDate() : null,
              cancelledAt: status === 'CANCELLED' ? start.minus({ hours: 6 }).toJSDate() : null,
              cancelledBy: status === 'CANCELLED' ? 'CUSTOMER' : null,
              cancelReason: status === 'CANCELLED' ? 'Customer asked to cancel' : null,
              noShowAt: status === 'NO_SHOW' ? end.toJSDate() : null,
              customerNote:
                rand() < 0.08
                  ? pick([
                      'Keep length on top',
                      'Sensitive skin',
                      'Running 5 min late usually',
                      'Wants a #2 on the sides',
                    ])
                  : null,
            });
            // Most completed visits have the money recorded; some partially.
            if (status === 'COMPLETED' && rand() < 0.8)
              payments.push({
                idx: appts.length - 1,
                amount: rand() < 0.9 ? svc.price : Math.round(svc.price / 2),
              });
            lastBlockEnd = m + svc.dur + svc.bufA;
            m = lastBlockEnd;
          } else {
            m += 30;
          }
        }
      }
    }
  }
  await db.appointment.createMany({ data: appts });
  const created = await db.appointment.findMany({
    where: { tenantId },
    select: { id: true, startAt: true, staffId: true },
    orderBy: { startAt: 'asc' },
  });
  const byKey = new Map(created.map((a) => [`${a.staffId}|${a.startAt.toISOString()}`, a.id]));
  const pays = payments
    .map((p) => {
      const a = appts[p.idx]!;
      const id = byKey.get(`${a.staffId}|${(a.startAt as Date).toISOString()}`);
      return id && p.amount > 0
        ? {
            tenantId,
            appointmentId: id,
            kind: 'PAYMENT' as const,
            amountMinor: p.amount,
            currency: 'USD',
            method: rand() < 0.6 ? ('CARD' as const) : ('CASH' as const),
            recordedByUserId: ownerId,
            recordedAt: a.endAt as Date,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (pays.length) await db.paymentRecord.createMany({ data: pays });
  console.log(`  ${appts.length} appointments, ${pays.length} payments`);
}

async function main() {
  passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const admin = await user('admin@tempo.test', 'Priya Hale', 'ADMIN');
  for (const t of TENANTS) await seedTenant(t, admin);
  await db.featureFlag.createMany({
    data: [
      { key: 'newEditor', name: 'New booking-page editor', note: 'All tenants', enabled: true },
      { key: 'multiLoc', name: 'Multiple locations', note: 'Business plan only', enabled: true },
      { key: 'waitlist', name: 'Waitlist', note: 'Planned · internal testing', enabled: false },
      { key: 'gcal', name: 'Google Calendar sync', note: 'Planned integration', enabled: false },
      { key: 'payments', name: 'Online payments', note: 'Planned integration', enabled: false },
    ],
    skipDuplicates: true,
  });
  console.log('\nSeed complete. Dev accounts (new ones only use this password):');
  console.log('  admin@tempo.test        platform admin');
  console.log('  marcus@northside.test   owner · northside-barber, northside-eastgate');
  console.log(
    '  amara@sableandsage.test · elena@harborphysio.test · kai@forgelab.test · ravi@mendwell.test',
  );
  console.log(
    process.env.SEED_PASSWORD
      ? '  password: (from SEED_PASSWORD)'
      : `  password: ${PASSWORD}   ← shown once; set SEED_PASSWORD to choose your own`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
