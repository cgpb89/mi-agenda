'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookingFlow } from '@/components/features/booking/BookingFlow';
import type { TemplateKey } from '@/components/features/booking/themes';
import { useBrowserTimeZone } from '@/lib/hooks';
import { DEMO } from './demo-data';
import { OFF, STREET_SPACING, Street } from './Street';
import styles from './Landing.module.scss';

const SCENES = [
  {
    time: '08:40',
    kind: 'Barbershop',
    name: 'Northside Barber Co.',
    line: 'The first chair of the day was booked last night.',
    sky: '#f2e6d5',
  },
  {
    time: '11:15',
    kind: 'Beauty studio',
    name: 'Sable & Sage Studio',
    line: 'Treatments, practitioners and prep notes on one page.',
    sky: '#f1ebe3',
  },
  {
    time: '13:30',
    kind: 'Physio clinic',
    name: 'Harbor Physio & Consulting',
    line: 'Consultation types, in person or by video.',
    sky: '#e6ece8',
  },
  {
    time: '17:45',
    kind: 'Fitness studio',
    name: 'Forge Training Lab',
    line: 'One-to-one, partner and small-group sessions.',
    sky: '#f0dfcc',
  },
  {
    time: '19:20',
    kind: 'Repair & advisory',
    name: 'Mendwell Repair & Advisory',
    line: 'Any business that runs on appointments.',
    sky: '#dcd8e0',
  },
];

const TPL: Record<
  TemplateKey,
  {
    label: string;
    biz: string;
    slug: string;
    headline: string;
    font: string;
    weight: number;
    style: string;
    stretch: string;
    upper: 'uppercase' | 'none';
    bg: string;
    ink: string;
    btn: string;
    btnInk: string;
    desc: string;
  }
> = {
  barber: {
    label: 'Barber & hair',
    biz: 'Northside Barber Co.',
    slug: 'northside-barber',
    headline: 'NORTHSIDE BARBER CO.',
    font: 'var(--font-anton), sans-serif',
    weight: 400,
    style: 'normal',
    stretch: 'normal',
    upper: 'uppercase',
    bg: '#16120f',
    ink: '#f3ece2',
    btn: '#d6a15c',
    btnInk: '#16120f',
    desc: 'Dark, editorial and photo-led. Barber profiles up front, prices with dotted leaders.',
  },
  wellness: {
    label: 'Beauty & wellness',
    biz: 'Sable & Sage Studio',
    slug: 'sable-and-sage',
    headline: 'A quieter hour, set aside for you.',
    font: 'var(--font-cormorant), serif',
    weight: 400,
    style: 'italic',
    stretch: 'normal',
    upper: 'none',
    bg: '#f4efe6',
    ink: '#3a3128',
    btn: '#7f6545',
    btnInk: '#fbf8f2',
    desc: 'Calm, centred and airy. Treatment categories, practitioners and preparation notes.',
  },
  consult: {
    label: 'Consultations',
    biz: 'Harbor Physio & Consulting',
    slug: 'harbor-physio',
    headline: 'Book a consultation',
    font: 'var(--font-public-sans), sans-serif',
    weight: 700,
    style: 'normal',
    stretch: 'normal',
    upper: 'none',
    bg: '#eef3f9',
    ink: '#14233a',
    btn: '#1f5fbf',
    btnInk: '#ffffff',
    desc: 'Clear and accessible. Practitioner profiles, in-person or video, and visible policies. Only contact details are collected.',
  },
  fitness: {
    label: 'Fitness & coaching',
    biz: 'Forge Training Lab',
    slug: 'forge-training-lab',
    headline: 'TRAIN WITH INTENT.',
    font: 'var(--font-archivo), sans-serif',
    weight: 900,
    style: 'italic',
    stretch: '62%',
    upper: 'uppercase',
    bg: '#0e0f0c',
    ink: '#f2f5ea',
    btn: '#c8f542',
    btnInk: '#0e0f0c',
    desc: 'Loud and kinetic. Session types, group sizes and coaches.',
  },
  services: {
    label: 'General services',
    biz: 'Mendwell Repair & Advisory',
    slug: 'mendwell',
    headline: 'Repairs and advice, by appointment.',
    font: 'var(--font-schibsted), sans-serif',
    weight: 800,
    style: 'normal',
    stretch: 'normal',
    upper: 'none',
    bg: '#efefec',
    ink: '#1d1f22',
    btn: '#d9532a',
    btnInk: '#ffffff',
    desc: 'Neutral and modular. Fits consultants, repair shops, tutors and photographers.',
  },
};

const PLANS = [
  {
    name: 'Starter',
    for: 'For one person taking bookings.',
    feats: [
      'One booking page',
      'One staff calendar',
      'All five templates',
      'Calendar and appointment list',
      'Core analytics',
    ],
  },
  {
    name: 'Growth',
    for: 'For a small team with set schedules.',
    feats: [
      'Everything in Starter',
      'Up to 5 staff schedules',
      'Customer directory',
      'Full analytics and filters',
      'Custom brand colours and type',
    ],
  },
  {
    name: 'Business',
    for: 'For busy teams and multiple locations.',
    feats: [
      'Everything in Growth',
      'Unlimited staff',
      'Multiple locations',
      'Roles and permissions',
      'Data export',
    ],
  },
];

const COMPARE = [
  ['Booking pages', '1', '1', '1 per location'],
  ['Staff calendars', '1', 'Up to 5', 'Unlimited'],
  ['Templates', 'All five', 'All five', 'All five'],
  ['Custom colours and type', 'Preset', '✓', '✓'],
  ['Customer directory', '—', '✓', '✓'],
  ['Analytics', 'Core', 'Full', 'Full + export'],
  ['Roles and permissions', '—', '—', '✓'],
  ['Payments, SMS reminders', 'Planned', 'Planned', 'Planned'],
];

const BENEFITS = [
  [
    'Bookings around the clock',
    'Your page takes appointments while you sleep, cut hair or take a day off.',
  ],
  [
    'Fewer double bookings',
    'Every slot checks staff hours, service length, breaks and existing appointments.',
  ],
  [
    'Hours that fit how you work',
    'Split shifts, different days, per-person schedules and services of any length.',
  ],
  ['A page that looks like you', 'Five templates, your colours, type and policies. No code.'],
  [
    'Numbers you can act on',
    'Busy days, quiet hours and popular services, with clear labels for what each metric counts.',
  ],
  [
    'One place for every appointment',
    'Online, phone and walk-in bookings in a single calendar and list.',
  ],
];

function target(i: number): [number, number] {
  const o = OFF[i]! * 0.55;
  return [i * STREET_SPACING + o, i * STREET_SPACING - o];
}

export function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLElement>(null);
  const oRef = useRef<HTMLElement>(null);
  const raf = useRef<number | null>(null);
  const [st, setSt] = useState({
    scene: 0,
    dotP: 0,
    b: 0,
    o: 0,
    scrolled: false,
    narrow: false,
    flat: false,
  });
  const [tpl, setTpl] = useState<TemplateKey>('barber');
  const [annual, setAnnual] = useState(false);
  const [plan, setPlan] = useState(1);
  const [compare, setCompare] = useState(false);
  const browserTz = useBrowserTimeZone();

  const tick = useCallback(() => {
    const vh = innerHeight;
    const narrow = innerWidth < 820;
    const flat = innerWidth < 700 || vh < 480;
    const prog = (el: HTMLElement | null) => {
      if (!el) return 0;
      const b = el.getBoundingClientRect();
      return Math.min(1, Math.max(0, -b.top / Math.max(1, b.height - vh)));
    };
    const p = prog(heroRef.current);
    const s = Math.min(4, p * 4.6);
    const i = Math.min(3, Math.floor(s));
    const f = s - i;
    const e = f < 0.3 ? 0 : f > 0.75 ? 1 : ((t: number) => t * t * (3 - 2 * t))((f - 0.3) / 0.45);
    const sf = s >= 4 ? 4 : i + e;
    const a = target(i);
    const bb = target(Math.min(4, i + 1));
    const cx = s >= 4 ? target(4)[0] : a[0] + (bb[0] - a[0]) * e;
    const cy = s >= 4 ? target(4)[1] : a[1] + (bb[1] - a[1]) * e;
    const z = (narrow ? 0.55 : 0.95) * (0.82 + 0.18 * Math.min(1, p * 6));
    if (worldRef.current)
      worldRef.current.style.transform = `scale(${z}) rotateX(58deg) rotateZ(-45deg) translate3d(${-cx}px,${-cy}px,0)`;
    if (heroTextRef.current) {
      const op = 1 - Math.min(1, Math.max(0, (p - 0.03) / 0.07));
      heroTextRef.current.style.opacity = String(op);
      heroTextRef.current.style.transform = `translateY(${(1 - op) * -30}px)`;
      heroTextRef.current.style.pointerEvents = op < 0.1 ? 'none' : 'auto';
    }
    const ns = {
      scene: Math.round(sf),
      dotP: Math.round(sf * 10) / 10,
      b: Math.min(2, Math.floor(prog(bRef.current) * 3)),
      o: Math.min(4, Math.floor(prog(oRef.current) * 5)),
      scrolled: scrollY > 40,
      narrow,
      flat,
    };
    setSt((prev) =>
      (Object.keys(ns) as (keyof typeof ns)[]).some((k) => ns[k] !== prev[k]) ? ns : prev,
    );
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (raf.current !== null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        tick();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    tick();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [tick]);

  const sc = SCENES[st.scene]!;
  const tp = TPL[tpl];
  const demo = DEMO[tpl];
  const rev = [2.9, 3.1, 3.0, 3.4, 3.3, 3.6, 3.5, 3.9, 3.8, 4.1, 4.0, 4.3];
  const pts = rev
    .map((v, i) => `${((i * 600) / 11).toFixed(1)},${(180 - ((v - 2.4) / 2.2) * 170).toFixed(1)}`)
    .join(' ');
  const stickPos = st.flat ? 'relative' : 'sticky';
  const stickH = st.flat ? 'auto' : '100vh';

  const flow = useMemo(
    () => (
      <BookingFlow
        key={tpl}
        slug="demo"
        template={tpl}
        businessName={demo.name}
        timezone={browserTz}
        currency="USD"
        country="US"
        address={demo.address}
        policyText={demo.policy}
        requireEmail
        minNoticeMin={60}
        cancellationWindowMin={240}
        services={demo.services}
        staff={demo.staff}
        demo={demo}
      />
    ),
    [tpl, demo, browserTz],
  );

  return (
    <div className={styles.page}>
      <div
        className={styles.nav}
        style={{ background: st.scrolled ? 'rgba(244,240,232,.82)' : 'transparent' }}
      >
        <a
          href="#top"
          style={{
            textDecoration: 'none',
            fontFamily: 'var(--font-bricolage)',
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: '-.04em',
          }}
        >
          tempo<span style={{ color: '#e0773a' }}>.</span>
        </a>
        <div className={styles.navLinks}>
          <a href="#journey">How it works</a>
          <a href="#templates">Templates</a>
          <a href="#pricing">Pricing</a>
        </div>
        <Link href="/login" style={{ textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          Log in
        </Link>
        <Link
          href="/signup"
          className={styles.pillDark}
          style={{ fontSize: 14, padding: '10px 18px' }}
        >
          Start free
        </Link>
      </div>

      {/* 01 Hero */}
      <section
        id="top"
        ref={heroRef}
        data-screen-label="01 Hero"
        style={{ height: '520vh', position: 'relative' }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'hidden',
            background: sc.sky,
            transition: 'background 1.2s ease',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, perspective: 3200 }} aria-hidden="true">
            <div
              ref={worldRef}
              style={{
                position: 'absolute',
                left: st.narrow ? '50%' : '64%',
                top: '62%',
                width: 0,
                height: 0,
                transformStyle: 'preserve-3d',
              }}
            >
              <Street active={st.scene} dotP={st.dotP} />
            </div>
          </div>
          <div
            ref={heroTextRef}
            style={{
              position: 'absolute',
              left: 'clamp(16px,4vw,64px)',
              top: 'clamp(96px,16vh,160px)',
              maxWidth: 'min(620px,88vw)',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
            }}
          >
            <h1
              className={styles.display}
              style={{ fontSize: 'clamp(48px,7.2vw,112px)', lineHeight: 0.92, textWrap: 'balance' }}
            >
              Your next appointment starts here.
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 'clamp(17px,1.5vw,21px)',
                lineHeight: 1.5,
                maxWidth: 460,
                color: '#3f3a33',
              }}
            >
              Give your customers an easier way to book, and give yourself more time to run your
              business.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                href="/signup"
                className={styles.pillDark}
                style={{ padding: '15px 26px', fontSize: 16 }}
              >
                Start free
              </Link>
              <a
                href="#journey"
                className={styles.pillLight}
                style={{ padding: '15px 26px', fontSize: 16 }}
              >
                See how it works
              </a>
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 'clamp(16px,4vw,64px)',
              bottom: 'clamp(20px,5vh,48px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxWidth: 'min(420px,80vw)',
              background: 'rgba(250,247,241,.88)',
              backdropFilter: 'blur(8px)',
              padding: '16px 18px',
              borderRadius: 14,
              border: '1px solid rgba(28,26,23,.08)',
              opacity: st.scrolled ? 1 : 0,
              transition: 'opacity .5s',
            }}
          >
            <div
              className={styles.mono}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'baseline',
                fontSize: 12,
                color: '#6b6358',
              }}
            >
              <span style={{ color: '#c4581f', fontWeight: 500 }}>{sc.time}</span>
              <span>{sc.kind}</span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-bricolage)',
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: '-.02em',
              }}
            >
              {sc.name}
            </div>
            <div style={{ fontSize: 14, color: '#4a443c', lineHeight: 1.45 }}>{sc.line}</div>
          </div>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 'clamp(14px,3vw,40px)',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {SCENES.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: i === st.scene ? 28 : 8,
                  borderRadius: 4,
                  background: i === st.scene ? '#1c1a17' : 'rgba(28,26,23,.25)',
                  transition: 'all .4s',
                }}
              />
            ))}
          </div>
          <div
            className={styles.mono}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 22,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              opacity: st.scrolled ? 0 : 1,
              transition: 'opacity .4s',
              fontSize: 11,
              color: '#6b6358',
            }}
          >
            <span>Scroll to walk the street</span>
            <span className={styles.cueLine} />
          </div>
        </div>
      </section>

      {/* 02 Booking journey */}
      <section
        id="journey"
        ref={bRef}
        data-screen-label="02 Booking journey"
        style={{ height: st.flat ? 'auto' : '320vh', position: 'relative', background: '#f4f0e8' }}
      >
        <div
          style={{
            position: stickPos,
            top: 0,
            height: stickH,
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
            alignItems: 'center',
            gap: 'clamp(20px,4vw,72px)',
            padding: '80px clamp(16px,5vw,96px) 40px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <span
              className={styles.mono}
              style={{ fontSize: 12, color: '#c4581f', letterSpacing: '.08em' }}
            >
              THE CUSTOMER&rsquo;S SIDE
            </span>
            {[
              [
                '01',
                'Find the business',
                'Customers land on your page from a link, a search or your socials.',
              ],
              [
                '02',
                'Pick a time that is actually free',
                'Only open slots appear. Breaks, buffers and existing bookings are already accounted for.',
              ],
              [
                '03',
                'Confirm in one tap',
                'A confirmation number, a calendar file and an easy way to reschedule.',
              ],
            ].map(([n, title, body], i) => (
              <div
                key={n}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  opacity: st.flat || i === st.b ? 1 : 0.28,
                  transition: 'opacity .5s',
                }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                  <span className={styles.mono} style={{ fontSize: 13, color: '#c4581f' }}>
                    {n}
                  </span>
                  <span
                    className={styles.display}
                    style={{
                      fontSize: 'clamp(26px,3vw,44px)',
                      letterSpacing: '-.035em',
                      lineHeight: 1,
                    }}
                  >
                    {title}
                  </span>
                </div>
                <p
                  style={{
                    margin: '0 0 0 34px',
                    fontSize: 17,
                    lineHeight: 1.5,
                    color: '#4a443c',
                    maxWidth: 440,
                  }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              height: 'min(640px,72vh)',
            }}
          >
            {!st.flat ? (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  fontFamily: 'var(--font-bricolage)',
                  fontWeight: 800,
                  fontSize: 'min(46vh,520px)',
                  lineHeight: 1,
                  color: '#ebe4d7',
                  letterSpacing: '-.06em',
                }}
              >
                0{st.b + 1}
              </div>
            ) : null}
            <Phone step={st.b} />
          </div>
        </div>
      </section>

      {/* 03 Owner journey */}
      <section
        ref={oRef}
        data-screen-label="03 Owner journey"
        style={{
          height: st.flat ? 'auto' : '420vh',
          position: 'relative',
          background: '#16150f',
          color: '#f1ece2',
        }}
      >
        <div
          style={{
            position: stickPos,
            top: 0,
            height: stickH,
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
            alignItems: 'center',
            gap: 'clamp(20px,4vw,64px)',
            padding: '80px clamp(16px,5vw,96px) 40px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <span
              className={styles.mono}
              style={{ fontSize: 12, color: '#e0773a', letterSpacing: '.08em' }}
            >
              AFTER HOURS, THE OWNER&rsquo;S SIDE
            </span>
            <h2
              className={styles.display}
              style={{
                fontSize: 'clamp(34px,4vw,60px)',
                lineHeight: 0.98,
                letterSpacing: '-.04em',
              }}
            >
              Set it up once. Tempo keeps the diary honest.
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {[
                [
                  'Set your hours',
                  'Weekly hours, split shifts and breaks. Holidays and one-off closures in a click.',
                ],
                ['Add services and prices', 'Duration, price and buffer time for every service.'],
                [
                  'Give each person a schedule',
                  'Staff keep their own hours and offer only the services they do.',
                ],
                [
                  'See the day at a glance',
                  'Online and walk-in bookings land in the same calendar.',
                ],
                [
                  'Know what is working',
                  'Demand by day and hour, popular services and estimated revenue.',
                ],
              ].map(([title, body], i) => {
                const on = st.flat || i === st.o;
                return (
                  <div
                    key={title}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px minmax(0,1fr)',
                      gap: 10,
                      padding: '12px 0',
                      borderTop: '1px solid rgba(241,236,226,.12)',
                      opacity: on ? 1 : 0.45,
                      transition: 'opacity .4s',
                    }}
                  >
                    <span
                      className={styles.mono}
                      style={{
                        fontSize: 12,
                        color: i === st.o ? '#e0773a' : '#7d766a',
                        paddingTop: 4,
                      }}
                    >
                      0{i + 1}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 18 }}>{title}</span>
                      {on ? (
                        <span style={{ fontSize: 15, color: '#bdb5a8', lineHeight: 1.5 }}>
                          {body}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <OwnerPanel step={st.o} />
        </div>
      </section>

      {/* 04 Templates */}
      <section
        id="templates"
        data-screen-label="04 Templates"
        className={styles.section}
        style={{ background: tp.bg, color: tp.ink, transition: 'background .6s, color .6s' }}
      >
        <div className={styles.inner}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            <h2 className={`${styles.display} ${styles.h2}`} style={{ maxWidth: 760 }}>
              Five booking pages. One booking engine.
            </h2>
            <p style={{ margin: 0, maxWidth: 380, fontSize: 17, lineHeight: 1.5, opacity: 0.8 }}>
              Each template changes the layout, type and mood. Services, staff and availability work
              the same underneath. Try one.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Booking page templates"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
              gap: 8,
            }}
          >
            {(Object.keys(TPL) as TemplateKey[]).map((k, i) => {
              const sel = k === tpl;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={sel}
                  onClick={() => setTpl(k)}
                  style={{
                    appearance: 'none',
                    font: 'inherit',
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 16,
                    borderRadius: 12,
                    border: `1px solid ${sel ? tp.btn : 'rgba(128,128,128,.3)'}`,
                    background: sel ? 'rgba(128,128,128,.12)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span className={styles.mono} style={{ fontSize: 11, opacity: 0.7 }}>
                    0{i + 1}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{TPL[k].label}</span>
                  <span style={{ fontSize: 13, opacity: 0.75 }}>{TPL[k].biz}</span>
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,400px),1fr))',
              gap: 'clamp(24px,4vw,56px)',
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <span
                style={{
                  fontFamily: tp.font,
                  fontSize: 'clamp(46px,6vw,92px)',
                  lineHeight: 0.9,
                  fontWeight: tp.weight,
                  fontStyle: tp.style,
                  fontStretch: tp.stretch,
                  textTransform: tp.upper,
                  letterSpacing: '-.02em',
                }}
              >
                {tp.headline}
              </span>
              <p
                style={{ margin: 0, fontSize: 17, lineHeight: 1.55, maxWidth: 460, opacity: 0.85 }}
              >
                {tp.desc}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a
                  href={`/book/${tp.slug}`}
                  style={{
                    textDecoration: 'none',
                    color: tp.btnInk,
                    background: tp.btn,
                    padding: '13px 20px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  Open the full demo page
                </a>
              </div>
              <span className={styles.mono} style={{ fontSize: 12, opacity: 0.65 }}>
                /book/{tp.slug}
              </span>
            </div>
            {flow}
          </div>
        </div>
      </section>

      {/* 05 Analytics */}
      <section
        data-screen-label="05 Analytics"
        className={styles.section}
        style={{ background: '#f4f0e8' }}
      >
        <div className={styles.inner}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))',
              gap: 24,
              alignItems: 'end',
            }}
          >
            <h2 className={`${styles.display} ${styles.h2}`}>See which hours earn their keep.</h2>
            <p
              style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: '#4a443c', maxWidth: 480 }}
            >
              Demand by day and hour, popular services, cancellations and estimated revenue, each
              with a plain label for what it counts.
            </p>
          </div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e3ddd2',
              borderRadius: 18,
              padding: 'clamp(16px,2.4vw,28px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              boxShadow: '0 30px 60px -40px rgba(60,40,20,.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 700 }}>Northside Barber Co. · Last 90 days</span>
              <span
                className={styles.mono}
                style={{
                  fontSize: 11,
                  color: '#857d70',
                  border: '1px solid #e3ddd2',
                  padding: '4px 8px',
                  borderRadius: 6,
                }}
              >
                DEMO DATA
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
                gap: 10,
              }}
            >
              {[
                ['Appointments completed', '1,042', 'Status: completed'],
                ['Upcoming', '86', 'Next 30 days, confirmed or pending'],
                ['Estimated appointment value', '$43,860', 'Price × completed, not payments'],
                ['Cancellation rate', '6.1%', 'Cancelled ÷ all booked'],
              ].map(([l, v, n]) => (
                <div
                  key={l}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: '#f7f5f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: '#5d564b', fontWeight: 600 }}>{l}</span>
                  <span
                    className={styles.display}
                    style={{ fontSize: 32, letterSpacing: '-.03em' }}
                  >
                    {v}
                  </span>
                  <span style={{ fontSize: 12, color: '#5d564b' }}>{n}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: 16,
                  border: '1px solid #ece7de',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  gridColumn: st.narrow ? undefined : 'span 2',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    Estimated appointment value, weekly
                  </span>
                  <span style={{ fontSize: 12, color: '#5d564b' }}>Not collected payments</span>
                </div>
                <svg
                  viewBox="0 0 600 180"
                  preserveAspectRatio="none"
                  style={{ width: '100%', height: 180, display: 'block' }}
                  aria-hidden="true"
                >
                  <line x1="0" y1="45" x2="600" y2="45" stroke="#efebe4" />
                  <line x1="0" y1="90" x2="600" y2="90" stroke="#efebe4" />
                  <line x1="0" y1="135" x2="600" y2="135" stroke="#efebe4" />
                  <polygon points={`0,180 ${pts} 600,180`} fill="#f6dccb" />
                  <polyline
                    points={pts}
                    fill="none"
                    stroke="#e0773a"
                    strokeWidth={2.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div
                  className={styles.mono}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    color: '#857d70',
                  }}
                >
                  <span>Jul 13</span>
                  <span>Aug 10</span>
                  <span>Sep 7</span>
                  <span>Oct 5</span>
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  border: '1px solid #ece7de',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>Busiest days</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
                  {[
                    ['M', 38],
                    ['T', 52],
                    ['W', 61],
                    ['T', 74],
                    ['F', 96],
                    ['S', 118],
                    ['S', 0],
                  ].map(([d, v], i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <span
                        style={{
                          width: '100%',
                          height: `${((v as number) / 118) * 100}%`,
                          background: i === 5 ? '#e0773a' : '#d7cfc1',
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                      <span style={{ fontSize: 11, color: '#5d564b', fontWeight: 600 }}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  border: '1px solid #ece7de',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>Peak booking hours</span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(10,minmax(0,1fr))',
                    gap: 3,
                  }}
                >
                  {[6, 9, 12, 10, 5, 8, 11, 15, 18, 14].map((v, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          width: '100%',
                          aspectRatio: '1/1.6',
                          borderRadius: 4,
                          background: `oklch(${0.96 - (v / 18) * 0.5} ${0.02 + (v / 18) * 0.1} 160)`,
                        }}
                      />
                      <span style={{ fontSize: 10, color: '#5d564b' }}>{((i + 8) % 12) + 1}</span>
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: '#5d564b' }}>
                  Appointments starting each hour. 5 PM is the fullest.
                </span>
              </div>
              <div
                style={{
                  padding: 16,
                  border: '1px solid #ece7de',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>Most popular services</span>
                {[
                  ['Skin Fade', 31],
                  ['Classic Cut', 27],
                  ['Cut & Beard', 19],
                  ['Beard Trim', 14],
                  ['Hot Towel Shave', 9],
                ].map(([n, v]) => (
                  <div
                    key={n}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '110px minmax(0,1fr) 36px',
                      gap: 8,
                      alignItems: 'center',
                      fontSize: 13,
                    }}
                  >
                    <span>{n}</span>
                    <span
                      style={{
                        height: 10,
                        background: '#efebe4',
                        borderRadius: 5,
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          height: '100%',
                          width: `${((v as number) / 31) * 100}%`,
                          background: '#2f6e5a',
                        }}
                      />
                    </span>
                    <span style={{ textAlign: 'right', color: '#5d564b' }}>{v}%</span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: '#1c1a17',
                  color: '#f4f0e8',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  justifyContent: 'space-between',
                }}
              >
                <span className={styles.mono} style={{ fontSize: 11, color: '#e0773a' }}>
                  WHAT THE NUMBERS SUGGEST
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-bricolage)',
                    fontWeight: 600,
                    fontSize: 22,
                    lineHeight: 1.2,
                    letterSpacing: '-.02em',
                  }}
                >
                  Saturday 2–6 PM is 94% booked. Hot Towel Shave is chosen least.
                </span>
                <span style={{ fontSize: 13, color: '#bdb5a8' }}>
                  Worth testing: an extra Saturday chair, and featuring the shave on your booking
                  page.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 06 Benefits */}
      <section
        data-screen-label="06 Benefits"
        className={styles.section}
        style={{ background: '#ebe5da' }}
      >
        <div className={styles.inner} style={{ gap: 48 }}>
          <h2 className={`${styles.display} ${styles.h2}`} style={{ maxWidth: 900 }}>
            Less time on the phone. More time with the people in the chair.
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
              borderTop: '1px solid #d3cbbd',
            }}
          >
            {BENEFITS.map(([t, d], i) => (
              <div
                key={t}
                style={{
                  padding: '28px 28px 32px 0',
                  borderBottom: '1px solid #d3cbbd',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <span className={styles.mono} style={{ fontSize: 12, color: '#c4581f' }}>
                  0{i + 1}
                </span>
                <span
                  className={styles.display}
                  style={{ fontSize: 24, letterSpacing: '-.025em', lineHeight: 1.1 }}
                >
                  {t}
                </span>
                <span style={{ fontSize: 15, lineHeight: 1.55, color: '#4a443c', maxWidth: 360 }}>
                  {d}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 07 Pricing */}
      <section
        id="pricing"
        data-screen-label="07 Pricing"
        className={styles.section}
        style={{ background: '#f4f0e8' }}
      >
        <div className={styles.inner} style={{ maxWidth: 1200, gap: 36 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 className={`${styles.display} ${styles.h2}`}>Start free. Grow into it.</h2>
              <span style={{ fontSize: 15, color: '#5d564b' }}>
                Sample plans. Final prices are set at launch.
              </span>
            </div>
            <div
              role="group"
              aria-label="Billing"
              style={{ display: 'flex', background: '#e8e2d7', padding: 4, borderRadius: 999 }}
            >
              {[
                [false, 'Monthly'],
                [true, 'Annual'],
              ].map(([v, l]) => (
                <button
                  key={l as string}
                  type="button"
                  aria-pressed={annual === v}
                  onClick={() => setAnnual(v as boolean)}
                  style={{
                    appearance: 'none',
                    border: 0,
                    font: 'inherit',
                    fontWeight: 700,
                    fontSize: 14,
                    padding: '9px 16px',
                    borderRadius: 999,
                    cursor: 'pointer',
                    background: annual === v ? '#fff' : 'transparent',
                    color: '#1c1a17',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
              gap: 12,
            }}
          >
            {PLANS.map((p, i) => {
              const sel = plan === i;
              return (
                <button
                  key={p.name}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => setPlan(i)}
                  style={{
                    appearance: 'none',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 26,
                    borderRadius: 18,
                    border: `2px solid ${sel ? '#1c1a17' : '#e3ddd2'}`,
                    background: sel ? '#1c1a17' : '#fff',
                    color: sel ? '#f4f0e8' : '#1c1a17',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                    transition: 'all .25s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 20 }}>{p.name}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: '#e0773a',
                        color: '#1c1a17',
                        opacity: sel ? 1 : 0,
                      }}
                    >
                      Selected
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span
                      className={styles.display}
                      style={{ fontSize: 48, letterSpacing: '-.04em' }}
                    >
                      $ —
                    </span>
                    <span style={{ fontSize: 14, opacity: 0.7 }}>
                      {annual ? 'per month, billed yearly' : 'per month'}
                    </span>
                  </div>
                  <span style={{ fontSize: 15, opacity: 0.8, lineHeight: 1.45 }}>{p.for}</span>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      borderTop: `1px solid ${sel ? '#3a3731' : '#ece7de'}`,
                      paddingTop: 16,
                    }}
                  >
                    {p.feats.map((f) => (
                      <span key={f} style={{ fontSize: 14, display: 'flex', gap: 10 }}>
                        <span style={{ color: '#e0773a' }}>●</span>
                        {f}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              aria-expanded={compare}
              onClick={() => setCompare(!compare)}
              style={{
                appearance: 'none',
                border: '1px solid #cfc7b9',
                background: 'transparent',
                font: 'inherit',
                fontWeight: 700,
                fontSize: 14,
                padding: '11px 18px',
                borderRadius: 999,
                cursor: 'pointer',
                color: '#1c1a17',
              }}
            >
              {compare ? 'Hide feature comparison' : 'Compare all features'}
            </button>
            <Link
              href="/signup"
              style={{
                textDecoration: 'none',
                background: '#e0773a',
                color: '#1c1a17',
                padding: '14px 24px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              Start free with {PLANS[plan]!.name}
            </Link>
          </div>
          {compare ? (
            <div
              style={{
                overflowX: 'auto',
                border: '1px solid #e3ddd2',
                borderRadius: 14,
                background: '#fff',
              }}
            >
              <table
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 560 }}
              >
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    {['Feature', 'Starter', 'Growth', 'Business'].map((h) => (
                      <th
                        key={h}
                        style={{ padding: '14px 16px', borderBottom: '1px solid #e3ddd2' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r[0]}>
                      {r.map((c, i) => (
                        <td
                          key={i}
                          style={{ padding: '12px 16px', borderBottom: '1px solid #f0ebe3' }}
                        >
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      {/* 08 Final CTA */}
      <section
        data-screen-label="08 Final CTA"
        style={{
          background: '#e0773a',
          color: '#1c1a17',
          padding: 'clamp(80px,12vw,180px) clamp(16px,5vw,96px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 32,
        }}
      >
        <h2
          className={styles.display}
          style={{
            fontSize: 'clamp(48px,8vw,140px)',
            lineHeight: 0.88,
            letterSpacing: '-.05em',
            maxWidth: 1200,
            textWrap: 'balance',
          }}
        >
          Make room for more of what matters.
        </h2>
        <Link
          href="/signup"
          className={styles.pillDark}
          style={{ padding: '18px 30px', fontSize: 18 }}
        >
          Create your booking page
        </Link>
      </section>

      <footer
        style={{
          background: '#16150f',
          color: '#bdb5a8',
          padding: '56px clamp(16px,5vw,96px) 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
          fontSize: 14,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
            gap: 28,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span
              style={{
                fontFamily: 'var(--font-bricolage)',
                fontWeight: 800,
                fontSize: 26,
                color: '#f1ece2',
                letterSpacing: '-.04em',
              }}
            >
              tempo<span style={{ color: '#e0773a' }}>.</span>
            </span>
            <span>Your time. Your business. Your way.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#f1ece2', fontWeight: 700 }}>Product</span>
            <a className={styles.footerLink} href="#journey">
              How it works
            </a>
            <a className={styles.footerLink} href="#pricing">
              Pricing
            </a>
            <Link className={styles.footerLink} href="/login">
              Log in
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#f1ece2', fontWeight: 700 }}>Templates</span>
            {(Object.keys(TPL) as TemplateKey[]).map((k) => (
              <a key={k} className={styles.footerLink} href={`/book/${TPL[k].slug}`}>
                {k === 'fitness' ? 'Fitness' : TPL[k].label}
              </a>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#f1ece2', fontWeight: 700 }}>Help</span>
            <span>Help centre (planned)</span>
            <span>Contact (planned)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#f1ece2', fontWeight: 700 }}>Legal</span>
            <span>Terms (planned)</span>
            <span>Privacy (planned)</span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 12,
            borderTop: '1px solid #2b2924',
            paddingTop: 20,
          }}
        >
          <span>© 2026 Tempo (working name).</span>
        </div>
      </footer>
    </div>
  );
}

function Phone({ step }: { step: number }) {
  const screen = (i: number) => ({
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    opacity: step === i ? 1 : 0,
    transform: step === i ? 'none' : step < i ? 'translateY(30px)' : 'translateY(-30px)',
    transition: 'all .6s cubic-bezier(.2,.7,.2,1)',
  });
  const slots = [
    '9:00',
    '9:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '1:30',
    '2:00',
    '2:30',
    '3:00',
    '3:30',
    '4:00',
  ];
  const taken = [1, 2, 4, 6, 7, 10];
  return (
    <div
      style={{
        position: 'relative',
        width: 'min(320px,72vw)',
        height: 'min(640px,72vh)',
        borderRadius: 44,
        background: '#1c1a17',
        padding: 10,
        boxShadow: '0 40px 80px -30px rgba(60,40,20,.45)',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 36,
          overflow: 'hidden',
          background: '#1f1a16',
          color: '#f3ece2',
          fontFamily: 'var(--font-hanken)',
        }}
      >
        <div style={{ ...screen(0), padding: '44px 18px 18px' }}>
          <div
            style={{
              height: 150,
              borderRadius: 4,
              background: 'repeating-linear-gradient(135deg,#2a231d 0 10px,#221c17 10px 20px)',
              display: 'flex',
              alignItems: 'flex-end',
              padding: 10,
            }}
          >
            <span
              style={{
                fontSize: 30,
                lineHeight: 0.9,
                fontFamily: 'var(--font-bricolage)',
                fontWeight: 800,
                letterSpacing: '-.02em',
              }}
            >
              NORTHSIDE
              <br />
              BARBER CO.
            </span>
          </div>
          {[
            ['Classic Cut', '$38'],
            ['Skin Fade', '$45'],
            ['Beard Trim', '$22'],
            ['Cut & Beard', '$58'],
          ].map(([n, p], i) => (
            <div
              key={n}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '11px 12px',
                border: `1px solid ${i === 1 ? '#d6a15c' : 'rgba(243,236,226,.16)'}`,
                background: i === 1 ? 'rgba(214,161,92,.14)' : 'transparent',
                borderRadius: 3,
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600 }}>{n}</span>
              <span style={{ color: '#d6a15c', fontWeight: 600 }}>{p}</span>
            </div>
          ))}
        </div>
        <div style={{ ...screen(1), padding: '44px 18px 18px' }}>
          <span style={{ fontSize: 12, color: '#b0a393' }}>Skin Fade · 60 min · Marcus</span>
          <span style={{ fontFamily: 'var(--font-bricolage)', fontWeight: 700, fontSize: 22 }}>
            Saturday, Oct 10
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {slots.map((t, i) => {
              const tk = taken.includes(i);
              const sel = i === 8;
              return (
                <span
                  key={t}
                  style={{
                    padding: '10px 0',
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 3,
                    border: `1px solid ${sel ? '#d6a15c' : tk ? 'transparent' : 'rgba(243,236,226,.2)'}`,
                    background: sel ? '#d6a15c' : tk ? 'rgba(243,236,226,.05)' : 'transparent',
                    color: sel ? '#1b1714' : tk ? '#7d7266' : '#f3ece2',
                    textDecoration: tk ? 'line-through' : 'none',
                  }}
                >
                  {t}
                </span>
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: '#8c7f70' }}>Struck-through times are taken</span>
        </div>
        <div style={{ ...screen(2), padding: '60px 20px 20px', gap: 14 }}>
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#d6a15c',
              color: '#1b1714',
              display: 'grid',
              placeItems: 'center',
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            ✓
          </span>
          <span
            style={{
              fontFamily: 'var(--font-bricolage)',
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: '-.03em',
              lineHeight: 1,
            }}
          >
            You&rsquo;re booked.
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#b0a393' }}>
            TMP-4821-K
          </span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderTop: '1px solid rgba(243,236,226,.14)',
              fontSize: 13,
            }}
          >
            {[
              ['Service', 'Skin Fade'],
              ['With', 'Marcus Reed'],
              ['When', 'Sat, Oct 10 · 2:30 PM'],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(243,236,226,.14)',
                }}
              >
                <span style={{ color: '#b0a393' }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
          <span
            style={{
              marginTop: 'auto',
              padding: 12,
              textAlign: 'center',
              background: '#d6a15c',
              color: '#1b1714',
              fontWeight: 700,
              fontSize: 14,
              borderRadius: 3,
            }}
          >
            Add to calendar
          </span>
        </div>
      </div>
    </div>
  );
}

function OwnerPanel({ step }: { step: number }) {
  const title = ['Availability', 'Services', 'Staff', 'Today', 'Analytics'][step];
  const shade = ['#efebe4', '#c7dcd3', '#7fb09d', '#2f6e5a'];
  return (
    <div
      style={{
        background: '#f7f5f0',
        color: '#1c1a17',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 50px 100px -40px rgba(0,0,0,.7)',
        minHeight: 420,
        display: 'flex',
        flexDirection: 'column',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid #e6e1d8',
          background: '#fff',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ width: 10, height: 10, borderRadius: '50%', background: '#e6e1d8' }}
          />
        ))}
        <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700 }}>Northside Barber Co.</span>
        <span style={{ fontSize: 12, color: '#857d70' }}>/ {title}</span>
      </div>
      <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {step === 0 ? (
          <>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
              const open = i < 6;
              const e = i === 5 ? 18 : 19;
              return (
                <div
                  key={d}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '44px minmax(0,1fr) 110px',
                    gap: 12,
                    alignItems: 'center',
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{d}</span>
                  <div
                    style={{
                      position: 'relative',
                      height: 22,
                      background: '#efebe4',
                      borderRadius: 4,
                    }}
                  >
                    {open ? (
                      <>
                        <span
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${(2 / 14) * 100}%`,
                            width: `${((e - 9) / 14) * 100}%`,
                            background: '#2f6e5a',
                            borderRadius: 4,
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${(6 / 14) * 100}%`,
                            width: `${(0.5 / 14) * 100}%`,
                            background:
                              'repeating-linear-gradient(135deg,#efebe4 0 4px,#cfc8bb 4px 8px)',
                          }}
                        />
                      </>
                    ) : null}
                  </div>
                  <span style={{ color: '#5d564b', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {open ? (i === 5 ? '9:00–18:00' : '9:00–19:00') : 'Closed'}
                  </span>
                </div>
              );
            })}
          </>
        ) : null}
        {step === 1
          ? [
              ['Classic Cut', 45, 38],
              ['Skin Fade', 60, 45],
              ['Beard Trim', 30, 22],
              ['Cut & Beard', 75, 58],
              ['Hot Towel Shave', 45, 40],
            ].map(([n, d, p]) => (
              <div
                key={n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) 70px 60px 34px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '11px 12px',
                  background: '#fff',
                  border: '1px solid #e6e1d8',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                <span style={{ fontWeight: 600 }}>{n}</span>
                <span style={{ color: '#5d564b', fontSize: 13 }}>{d} min</span>
                <span style={{ fontWeight: 600 }}>${p}</span>
                <span
                  style={{
                    width: 30,
                    height: 18,
                    borderRadius: 9,
                    background: '#2f6e5a',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      right: 2,
                      top: 2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#fff',
                    }}
                  />
                </span>
              </div>
            ))
          : null}
        {step === 2 ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px repeat(7,minmax(0,1fr))',
                gap: 4,
                fontSize: 11,
                color: '#5d564b',
                fontWeight: 600,
              }}
            >
              <span />
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            {[
              ['Marcus Reed', [3, 3, 0, 3, 3, 3, 0]],
              ['Theo Alvarez', [2, 3, 3, 3, 3, 2, 0]],
              ['Jun Park', [0, 2, 3, 3, 3, 3, 0]],
              ['Dana Okafor', [2, 2, 2, 0, 2, 3, 0]],
            ].map(([n, days]) => (
              <div
                key={n as string}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px repeat(7,minmax(0,1fr))',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{n}</span>
                {(days as number[]).map((v, i) => (
                  <span key={i} style={{ height: 26, borderRadius: 4, background: shade[v] }} />
                ))}
              </div>
            ))}
            <span style={{ fontSize: 12, color: '#5d564b', marginTop: 6 }}>
              Each barber&rsquo;s own week. Darker means a longer shift.
            </span>
          </>
        ) : null}
        {step === 3
          ? [
              [
                '9:00',
                'Andre Wallace',
                'Skin Fade · Marcus',
                'Completed',
                '#2f6e5a',
                '#e3efe9',
                '#1f5040',
              ],
              [
                '10:15',
                'Sam Whitfield',
                'Classic Cut · Theo',
                'Completed',
                '#2f6e5a',
                '#e3efe9',
                '#1f5040',
              ],
              [
                '11:30',
                'Luis Ortega',
                'Cut & Beard · Marcus',
                'Confirmed',
                '#e0773a',
                '#fbe6d8',
                '#8a3d12',
              ],
              [
                '12:00',
                'Ben Carter',
                'Beard Trim · Jun',
                'Pending',
                '#c9a227',
                '#f6edd0',
                '#6e5609',
              ],
              [
                '14:30',
                'Tom Nguyen',
                'Skin Fade · Theo',
                'Confirmed',
                '#e0773a',
                '#fbe6d8',
                '#8a3d12',
              ],
            ].map(([t, c, s, status, color, bbg, bink]) => (
              <div
                key={t}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '62px 4px minmax(0,1fr) auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: '#fff',
                  border: '1px solid #e6e1d8',
                  borderRadius: 8,
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t}</span>
                <span style={{ height: 30, borderRadius: 2, background: color }} />
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c}</span>
                  <span style={{ fontSize: 12, color: '#5d564b' }}>{s}</span>
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: bbg,
                    color: bink,
                  }}
                >
                  {status}
                </span>
              </div>
            ))
          : null}
        {step === 4 ? (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 13, color: '#5d564b' }}>
                Estimated appointment value · last 12 weeks
              </span>
              <span style={{ fontFamily: 'var(--font-bricolage)', fontWeight: 700, fontSize: 28 }}>
                $43,860
              </span>
            </div>
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 200 }}
            >
              {[2.9, 3.1, 3.0, 3.4, 3.3, 3.6, 3.5, 3.9, 3.8, 4.1, 4.0, 4.3].map((v, i) => (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: `${((v - 2) / 2.5) * 100}%`,
                    background: i === 11 ? '#e0773a' : '#d7cfc1',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#5d564b' }}>
              Estimated value of completed appointments. Collected payments are tracked separately.
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
