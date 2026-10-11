'use client';

import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookingFlow } from '@/components/features/booking/BookingFlow';
import type { TemplateKey } from '@/components/features/booking/themes';
import { useBrowserTimeZone } from '@/lib/hooks';
import { demoFor } from './demo-data';
import { OFF, STREET_SPACING, Street } from './Street';
import styles from './Landing.module.scss';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { useI18n } from '@/i18n/client';

const SCENES = [
  {
    time: '08:40',
    name: 'Northside Barber Co.',
    sky: '#f2e6d5',
  },
  {
    time: '11:15',
    name: 'Sable & Sage Studio',
    sky: '#f1ebe3',
  },
  {
    time: '13:30',
    name: 'Harbor Physio & Consulting',
    sky: '#e6ece8',
  },
  {
    time: '17:45',
    name: 'Forge Training Lab',
    sky: '#f0dfcc',
  },
  {
    time: '19:20',
    name: 'Mendwell Repair & Advisory',
    sky: '#dcd8e0',
  },
];

const TPL: Record<
  TemplateKey,
  {
    biz: string;
    slug: string;
    font: string;
    weight: number;
    style: string;
    stretch: string;
    upper: 'uppercase' | 'none';
    bg: string;
    ink: string;
    btn: string;
    btnInk: string;
  }
> = {
  barber: {
    biz: 'Northside Barber Co.',
    slug: 'northside-barber',
    font: 'var(--font-anton), sans-serif',
    weight: 400,
    style: 'normal',
    stretch: 'normal',
    upper: 'uppercase',
    bg: '#16120f',
    ink: '#f3ece2',
    btn: '#d6a15c',
    btnInk: '#16120f',
  },
  wellness: {
    biz: 'Sable & Sage Studio',
    slug: 'sable-and-sage',
    font: 'var(--font-cormorant), serif',
    weight: 400,
    style: 'italic',
    stretch: 'normal',
    upper: 'none',
    bg: '#f4efe6',
    ink: '#3a3128',
    btn: '#7f6545',
    btnInk: '#fbf8f2',
  },
  consult: {
    biz: 'Harbor Physio & Consulting',
    slug: 'harbor-physio',
    font: 'var(--font-public-sans), sans-serif',
    weight: 700,
    style: 'normal',
    stretch: 'normal',
    upper: 'none',
    bg: '#eef3f9',
    ink: '#14233a',
    btn: '#1f5fbf',
    btnInk: '#ffffff',
  },
  fitness: {
    biz: 'Forge Training Lab',
    slug: 'forge-training-lab',
    font: 'var(--font-archivo), sans-serif',
    weight: 900,
    style: 'italic',
    stretch: '62%',
    upper: 'uppercase',
    bg: '#0e0f0c',
    ink: '#f2f5ea',
    btn: '#c8f542',
    btnInk: '#0e0f0c',
  },
  services: {
    biz: 'Mendwell Repair & Advisory',
    slug: 'mendwell',
    font: 'var(--font-schibsted), sans-serif',
    weight: 800,
    style: 'normal',
    stretch: 'normal',
    upper: 'none',
    bg: '#efefec',
    ink: '#1d1f22',
    btn: '#d9532a',
    btnInk: '#ffffff',
  },
};

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
  const bVisRef = useRef<HTMLDivElement>(null);
  const oVisRef = useRef<HTMLDivElement>(null);
  const bStepRefs = useRef<(HTMLElement | null)[]>([]);
  const oStepRefs = useRef<(HTMLElement | null)[]>([]);
  const raf = useRef<number | null>(null);
  const [st, setSt] = useState({
    scene: 0,
    dotP: 0,
    b: 0,
    o: 0,
    scrolled: false,
    narrow: false,
    flat: false,
    phoneZoom: 1,
  });
  const [tpl, setTpl] = useState<TemplateKey>('barber');
  const [annual, setAnnual] = useState(false);
  const [plan, setPlan] = useState(1);
  const [compare, setCompare] = useState(false);
  const browserTz = useBrowserTimeZone();
  const { t, locale } = useI18n();
  const L = t.landing;

  const tick = useCallback(() => {
    const vh = innerHeight;
    const narrow = innerWidth < 820;
    const flat = innerWidth < 700 || vh < 480;
    const prog = (el: HTMLElement | null) => {
      if (!el) return 0;
      const b = el.getBoundingClientRect();
      return Math.min(1, Math.max(0, -b.top / Math.max(1, b.height - vh)));
    };
    // Stacked (mobile) layout: the visual sticks under the nav, and the active step is the
    // last one whose top has reached the upper third of the space left below the visual.
    const reached = (vis: HTMLElement | null, items: (HTMLElement | null)[]) => {
      const top = vis?.getBoundingClientRect().bottom ?? 0;
      const line = top + (vh - top) * 0.35;
      let idx = 0;
      items.forEach((el, k) => {
        if (el && el.getBoundingClientRect().top <= line) idx = k;
      });
      return idx;
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
    if (heroTextRef.current && flat) {
      heroTextRef.current.style.opacity = '';
      heroTextRef.current.style.transform = '';
      heroTextRef.current.style.pointerEvents = '';
    } else if (heroTextRef.current) {
      const op = 1 - Math.min(1, Math.max(0, (p - 0.03) / 0.07));
      heroTextRef.current.style.opacity = String(op);
      heroTextRef.current.style.transform = `translateY(${(1 - op) * -30}px)`;
      heroTextRef.current.style.pointerEvents = op < 0.1 ? 'none' : 'auto';
    }
    const ns = {
      scene: Math.round(sf),
      dotP: Math.round(sf * 10) / 10,
      b: flat
        ? reached(bVisRef.current, bStepRefs.current)
        : Math.min(2, Math.floor(prog(bRef.current) * 3)),
      o: flat
        ? reached(oVisRef.current, oStepRefs.current)
        : Math.min(4, Math.floor(prog(oRef.current) * 5)),
      scrolled: scrollY > 40,
      narrow,
      flat,
      phoneZoom: Math.round((Math.min(420, vh * 0.46) / 640) * 100) / 100,
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
  const scText = L.scenes[st.scene]!;
  const tp = TPL[tpl];
  const tpText = L.templates.items[tpl];
  const demo = demoFor(locale)[tpl];
  const rev = [2.9, 3.1, 3.0, 3.4, 3.3, 3.6, 3.5, 3.9, 3.8, 4.1, 4.0, 4.3];
  const pts = rev
    .map((v, i) => `${((i * 600) / 11).toFixed(1)},${(180 - ((v - 2.4) / 2.2) * 170).toFixed(1)}`)
    .join(' ');
  // Desktop pins the whole section; mobile stacks it and pins only the visual (see `reached`).
  const stage = (gap: string): CSSProperties =>
    st.flat
      ? {
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          padding: '80px 16px 40px',
        }
      : {
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
          alignItems: 'center',
          gap,
          padding: '80px clamp(16px,5vw,96px) 40px',
        };
  const stickyVisual = (bg: string): CSSProperties => ({
    order: 1,
    position: 'sticky',
    top: 72,
    zIndex: 1,
    background: bg,
    padding: '8px 0 16px',
    boxShadow: `0 16px 16px -8px ${bg}`,
  });

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
          <a href="#journey">{L.nav.howItWorks}</a>
          <a href="#templates">{L.nav.templates}</a>
          <a href="#pricing">{L.nav.pricing}</a>
        </div>
        <LocaleSwitcher />
        <Link href="/login" style={{ textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          {L.nav.logIn}
        </Link>
        <Link
          href="/signup"
          className={styles.pillDark}
          style={{ fontSize: 14, padding: '10px 18px' }}
        >
          {L.nav.startFree}
        </Link>
      </div>

      {/* 01 Hero */}
      <section id="top" ref={heroRef} data-screen-label="01 Hero" className={styles.hero}>
        <div
          className={styles.heroStage}
          style={{
            background: sc.sky,
            transition: 'background 1.2s ease',
          }}
        >
          <div
            className={styles.streetOnly}
            style={{ position: 'absolute', inset: 0, perspective: 3200 }}
            aria-hidden="true"
          >
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
            className={styles.heroText}
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
              {L.hero.title}
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
              {L.hero.sub}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                href="/signup"
                className={styles.pillDark}
                style={{ padding: '15px 26px', fontSize: 16 }}
              >
                {L.nav.startFree}
              </Link>
              <a
                href="#journey"
                className={styles.pillLight}
                style={{ padding: '15px 26px', fontSize: 16 }}
              >
                {L.hero.seeHow}
              </a>
            </div>
          </div>
          <div
            className={styles.streetOnly}
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
              <span>{scText.kind}</span>
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
            <div style={{ fontSize: 14, color: '#4a443c', lineHeight: 1.45 }}>{scText.line}</div>
          </div>
          <div
            aria-hidden="true"
            className={styles.streetOnly}
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
            className={`${styles.mono} ${styles.streetOnly}`}
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
            <span>{L.hero.scrollCue}</span>
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
        <div style={stage('clamp(20px,4vw,72px)')}>
          <div style={{ display: st.flat ? 'contents' : 'flex', flexDirection: 'column', gap: 28 }}>
            <span
              className={styles.mono}
              style={{ fontSize: 12, color: '#c4581f', letterSpacing: '.08em' }}
            >
              {L.customer.eyebrow}
            </span>
            {L.customer.steps.map(([title, body], i) => (
              <div
                key={i}
                ref={(el) => {
                  bStepRefs.current[i] = el;
                }}
                style={{
                  order: 2,
                  minHeight: st.flat ? '38vh' : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  opacity: i === st.b ? 1 : st.flat ? 0.35 : 0.28,
                  transition: 'opacity .5s',
                }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                  <span className={styles.mono} style={{ fontSize: 13, color: '#c4581f' }}>
                    0{i + 1}
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
            ref={bVisRef}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              ...(st.flat
                ? stickyVisual('#f4f0e8')
                : { position: 'relative', height: 'min(640px,72vh)' }),
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
            <Phone step={st.b} zoom={st.flat ? st.phoneZoom : undefined} />
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
        <div style={stage('clamp(20px,4vw,64px)')}>
          <div style={{ display: st.flat ? 'contents' : 'flex', flexDirection: 'column', gap: 22 }}>
            <span
              className={styles.mono}
              style={{ fontSize: 12, color: '#e0773a', letterSpacing: '.08em' }}
            >
              {L.owner.eyebrow}
            </span>
            <h2
              className={styles.display}
              style={{
                fontSize: 'clamp(34px,4vw,60px)',
                lineHeight: 0.98,
                letterSpacing: '-.04em',
              }}
            >
              {L.owner.title}
            </h2>
            <div
              style={{
                order: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginTop: 8,
              }}
            >
              {L.owner.steps.map(([title, body], i) => {
                const on = i === st.o;
                return (
                  <div
                    key={title}
                    ref={(el) => {
                      oStepRefs.current[i] = el;
                    }}
                    style={{
                      minHeight: st.flat ? '30vh' : undefined,
                      display: 'grid',
                      gridTemplateColumns: '28px minmax(0,1fr)',
                      gap: 10,
                      padding: '12px 0',
                      borderTop: '1px solid rgba(241,236,226,.12)',
                      opacity: on ? 1 : st.flat ? 0.4 : 0.45,
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
                      {on || st.flat ? (
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
          {st.flat ? (
            <div ref={oVisRef} style={stickyVisual('#16150f')}>
              <OwnerPanel step={st.o} compact />
            </div>
          ) : (
            <OwnerPanel step={st.o} />
          )}
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
              {L.templates.title}
            </h2>
            <p style={{ margin: 0, maxWidth: 380, fontSize: 17, lineHeight: 1.5, opacity: 0.8 }}>
              {L.templates.sub}
            </p>
          </div>
          <div
            role="tablist"
            aria-label={L.templates.tabsLabel}
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
                  <span style={{ fontWeight: 700, fontSize: 16 }}>
                    {L.templates.items[k].label}
                  </span>
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
                {tpText.headline}
              </span>
              <p
                style={{ margin: 0, fontSize: 17, lineHeight: 1.55, maxWidth: 460, opacity: 0.85 }}
              >
                {tpText.desc}
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
                  {L.templates.openDemo}
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
            <h2 className={`${styles.display} ${styles.h2}`}>{L.analytics.title}</h2>
            <p
              style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: '#4a443c', maxWidth: 480 }}
            >
              {L.analytics.sub}
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
              <span style={{ fontWeight: 700 }}>{L.analytics.header}</span>
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
                {L.analytics.demoData}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
                gap: 10,
              }}
            >
              {L.analytics.kpis.map(([l, v, n]) => (
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
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{L.analytics.weekly}</span>
                  <span style={{ fontSize: 12, color: '#5d564b' }}>{L.analytics.notPayments}</span>
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
                  {L.analytics.weekTicks.map((w) => (
                    <span key={w}>{w}</span>
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
                <span style={{ fontWeight: 700, fontSize: 14 }}>{L.analytics.busiestDays}</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
                  {[38, 52, 61, 74, 96, 118, 0].map((v, i) => (
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
                          height: `${(v / 118) * 100}%`,
                          background: i === 5 ? '#e0773a' : '#d7cfc1',
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                      <span style={{ fontSize: 11, color: '#5d564b', fontWeight: 600 }}>
                        {L.analytics.dayLetters[i]}
                      </span>
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
                <span style={{ fontWeight: 700, fontSize: 14 }}>{L.analytics.peakHours}</span>
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
                <span style={{ fontSize: 12, color: '#5d564b' }}>{L.analytics.peakNote}</span>
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
                <span style={{ fontWeight: 700, fontSize: 14 }}>{L.analytics.popular}</span>
                {(
                  [
                    [1, 31],
                    [0, 27],
                    [3, 19],
                    [2, 14],
                    [4, 9],
                  ] as const
                )
                  .map(([svc, v]) => [L.demo.barber.services[svc]![0], v] as const)
                  .map(([n, v]) => (
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
                            width: `${(v / 31) * 100}%`,
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
                  {L.analytics.suggestEyebrow}
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
                  {L.analytics.suggestTitle}
                </span>
                <span style={{ fontSize: 13, color: '#bdb5a8' }}>{L.analytics.suggestBody}</span>
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
            {L.benefits.title}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
              borderTop: '1px solid #d3cbbd',
            }}
          >
            {L.benefits.items.map(([title, d], i) => (
              <div
                key={title}
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
                  {title}
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
              <h2 className={`${styles.display} ${styles.h2}`}>{L.pricing.title}</h2>
              <span style={{ fontSize: 15, color: '#5d564b' }}>{L.pricing.sample}</span>
            </div>
            <div
              role="group"
              aria-label={L.pricing.billing}
              style={{ display: 'flex', background: '#e8e2d7', padding: 4, borderRadius: 999 }}
            >
              {[
                [false, L.pricing.monthly],
                [true, L.pricing.annual],
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
            {L.pricing.plans.map((p, i) => {
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
                      {L.pricing.selected}
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
                      {annual ? L.pricing.perMonthYearly : L.pricing.perMonth}
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
              {compare ? L.pricing.hideCompare : L.pricing.showCompare}
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
              {L.pricing.startWith({ plan: L.pricing.plans[plan]!.name })}
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
                    {[L.pricing.feature, ...L.pricing.plans.map((p) => p.name)].map((h) => (
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
                  {L.pricing.compare.map((r) => (
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
          {L.cta.title}
        </h2>
        <Link
          href="/signup"
          className={styles.pillDark}
          style={{ padding: '18px 30px', fontSize: 18 }}
        >
          {L.cta.button}
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
            <span>{L.footer.tagline}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#f1ece2', fontWeight: 700 }}>{L.footer.product}</span>
            <a className={styles.footerLink} href="#journey">
              {L.nav.howItWorks}
            </a>
            <a className={styles.footerLink} href="#pricing">
              {L.nav.pricing}
            </a>
            <Link className={styles.footerLink} href="/login">
              {L.nav.logIn}
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#f1ece2', fontWeight: 700 }}>{L.footer.templates}</span>
            {(Object.keys(TPL) as TemplateKey[]).map((k) => (
              <a key={k} className={styles.footerLink} href={`/book/${TPL[k].slug}`}>
                {k === 'fitness' ? L.templates.footerFitness : L.templates.items[k].label}
              </a>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#f1ece2', fontWeight: 700 }}>{L.footer.help}</span>
            <span>{L.footer.helpCentre}</span>
            <span>{L.footer.contact}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#f1ece2', fontWeight: 700 }}>{L.footer.legal}</span>
            <span>{L.footer.terms}</span>
            <span>{L.footer.privacy}</span>
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
          <span>{L.footer.copyright}</span>
        </div>
      </footer>
    </div>
  );
}

function Phone({ step, zoom }: { step: number; zoom?: number }) {
  const { t } = useI18n();
  const ph = t.landing.phone;
  const barber = t.landing.demo.barber.services;
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
        // Mobile renders the full-size phone and zooms it, so the screens keep their layout.
        width: zoom ? 320 : 'min(320px,72vw)',
        height: zoom ? 640 : 'min(640px,72vh)',
        zoom,
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
          {(
            [
              [0, '$38'],
              [1, '$45'],
              [2, '$22'],
              [3, '$58'],
            ] as const
          )
            .map(([svc, p]) => [barber[svc]![0], p] as const)
            .map(([n, p], i) => (
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
          <span style={{ fontSize: 12, color: '#b0a393' }}>{ph.selection}</span>
          <span style={{ fontFamily: 'var(--font-bricolage)', fontWeight: 700, fontSize: 22 }}>
            {ph.day}
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
          <span style={{ fontSize: 11, color: '#8c7f70' }}>{ph.takenHint}</span>
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
            {ph.booked}
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
              [ph.service, barber[1]![0]],
              [ph.with, 'Marcus Reed'],
              [ph.when, ph.whenValue],
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
            {ph.addToCalendar}
          </span>
        </div>
      </div>
    </div>
  );
}

function OwnerPanel({ step, compact }: { step: number; compact?: boolean }) {
  const { t } = useI18n();
  const pn = t.landing.panel;
  const barber = t.landing.demo.barber.services;
  const title = pn.titles[step];
  const shade = ['#efebe4', '#c7dcd3', '#7fb09d', '#2f6e5a'];
  return (
    <div
      style={{
        background: '#f7f5f0',
        color: '#1c1a17',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 50px 100px -40px rgba(0,0,0,.7)',
        minHeight: compact ? undefined : 420,
        height: compact ? 'min(360px,46vh)' : undefined,
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
      <div
        style={{
          padding: compact ? 14 : 20,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 8 : 10,
        }}
      >
        {step === 0 ? (
          <>
            {pn.days.map((d, i) => {
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
                    {open ? (i === 5 ? '9:00–18:00' : '9:00–19:00') : pn.closed}
                  </span>
                </div>
              );
            })}
          </>
        ) : null}
        {step === 1
          ? (
              [
                [45, 38],
                [60, 45],
                [30, 22],
                [75, 58],
                [45, 40],
              ] as const
            )
              .map(([d, p], i) => [barber[i]![0], d, p] as const)
              .map(([n, d, p]) => (
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
              {pn.dayLetters.map((d, i) => (
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
            <span style={{ fontSize: 12, color: '#5d564b', marginTop: 6 }}>{pn.staffCaption}</span>
          </>
        ) : null}
        {step === 3
          ? (
              [
                ['9:00', 'Andre Wallace', 0, 'COMPLETED', '#2f6e5a', '#e3efe9', '#1f5040'],
                ['10:15', 'Sam Whitfield', 1, 'COMPLETED', '#2f6e5a', '#e3efe9', '#1f5040'],
                ['11:30', 'Luis Ortega', 2, 'CONFIRMED', '#e0773a', '#fbe6d8', '#8a3d12'],
                ['12:00', 'Ben Carter', 3, 'PENDING', '#c9a227', '#f6edd0', '#6e5609'],
                ['14:30', 'Tom Nguyen', 4, 'CONFIRMED', '#e0773a', '#fbe6d8', '#8a3d12'],
              ] as const
            ).map(([time, c, line, status, color, bbg, bink]) => (
              <div
                key={time}
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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{time}</span>
                <span style={{ height: 30, borderRadius: 2, background: color }} />
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c}</span>
                  <span style={{ fontSize: 12, color: '#5d564b' }}>{pn.today[line]}</span>
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
                  {t.common.status[status]}
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
              <span style={{ fontSize: 13, color: '#5d564b' }}>{pn.valueLabel}</span>
              <span style={{ fontFamily: 'var(--font-bricolage)', fontWeight: 700, fontSize: 28 }}>
                $43,860
              </span>
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                minHeight: compact ? 0 : 200,
              }}
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
            <span style={{ fontSize: 12, color: '#5d564b' }}>{pn.valueNote}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
