'use client';

import type { CSSProperties, ReactNode } from 'react';
import styles from './Landing.module.scss';

/** CSS-3D isometric street of five businesses (ported from Tempo Landing.dc.html `buildWorld`). */
export const STREET_SPACING = 440;
export const OFF = [150, -150, 150, -150, 150];

interface Build {
  w: number;
  d: number;
  h: number;
  c: [string, string, string];
  sign: string;
  sb: string;
  si: string;
  win: string;
  sw: string;
  pin: [string, string];
  ex: [number, number, number, number, number, number, [string, string, string]][];
}

const BUILD: Build[] = [
  {
    w: 200,
    d: 150,
    h: 120,
    c: ['#efe4d4', '#c26a43', '#9a5134'],
    sign: 'NORTHSIDE BARBER',
    sb: '#1b1714',
    si: '#f3ece2',
    win: 'repeating-linear-gradient(90deg,#3a2a22 0 38px,#c26a43 38px 50px)',
    sw: 'repeating-linear-gradient(90deg,#9a5134 0 30px,#7f4029 30px 36px)',
    pin: ['08:40', 'Skin Fade · Marcus'],
    ex: [
      [
        -122,
        30,
        14,
        14,
        72,
        0,
        ['#f3ece2', 'repeating-linear-gradient(0deg,#c0392b 0 8px,#f3ece2 8px 16px)', '#c9c0b3'],
      ],
      [
        -90,
        75,
        180,
        16,
        6,
        78,
        ['#f3ece2', 'repeating-linear-gradient(90deg,#1b1714 0 14px,#f3ece2 14px 28px)', '#1b1714'],
      ],
    ],
  },
  {
    w: 180,
    d: 170,
    h: 100,
    c: ['#f4ece6', '#e2bfb3', '#c49c8f'],
    sign: 'SABLE & SAGE',
    sb: '#fbf8f2',
    si: '#5c4a3a',
    win: 'repeating-linear-gradient(90deg,#f7efe8 0 44px,#e2bfb3 44px 56px)',
    sw: 'repeating-linear-gradient(90deg,#c49c8f 0 26px,#b38a7d 26px 30px)',
    pin: ['11:15', 'Signature Facial · Amara'],
    ex: [
      [-80, 85, 160, 18, 6, 66, ['#a9bb9d', '#8aa07e', '#71866a']],
      [100, 40, 30, 30, 30, 0, ['#93ad7f', '#7d9a62', '#627f4a']],
    ],
  },
  {
    w: 230,
    d: 160,
    h: 150,
    c: ['#f4f5f2', '#e3e6e2', '#c3c8c4'],
    sign: 'HARBOR PHYSIO',
    sb: '#1f5fbf',
    si: '#ffffff',
    win: 'repeating-linear-gradient(90deg,#9fb8d9 0 34px,#e3e6e2 34px 44px)',
    sw: 'repeating-linear-gradient(90deg,#c3c8c4 0 10px,#8ea4c2 10px 34px)',
    pin: ['13:30', 'Initial assessment · Dr. Ruiz'],
    ex: [
      [-150, -60, 26, 26, 34, 0, ['#93ad7f', '#7d9a62', '#627f4a']],
      [-150, 0, 26, 26, 26, 0, ['#93ad7f', '#7d9a62', '#627f4a']],
    ],
  },
  {
    w: 260,
    d: 170,
    h: 110,
    c: ['#45463f', '#2a2b26', '#1e1f1b'],
    sign: 'FORGE / LAB',
    sb: '#c8f542',
    si: '#0e0f0c',
    win: 'repeating-linear-gradient(90deg,#55594a 0 70px,#2a2b26 70px 78px)',
    sw: 'repeating-linear-gradient(90deg,#1e1f1b 0 40px,#c8f542 40px 44px)',
    pin: ['17:45', 'Small Group HIIT · 4 of 6'],
    ex: [[-130, 95, 260, 6, 10, 0, ['#c8f542', '#a9d12f', '#86a823']]],
  },
  {
    w: 170,
    d: 170,
    h: 260,
    c: ['#d8dbe0', '#b4bbc5', '#8f97a3'],
    sign: 'MENDWELL',
    sb: '#d9532a',
    si: '#ffffff',
    win: 'repeating-linear-gradient(180deg,#b4bbc5 0 10px,#6f7a8a 10px 34px)',
    sw: 'repeating-linear-gradient(90deg,#8f97a3 0 10px,#5e6877 10px 34px)',
    pin: ['19:20', 'Laptop diagnostic · Ravi'],
    ex: [[110, -40, 34, 34, 40, 0, ['#93ad7f', '#7d9a62', '#627f4a']]],
  },
];

function Face({ style, children }: { style: CSSProperties; children?: ReactNode }) {
  return <div style={{ position: 'absolute', boxSizing: 'border-box', ...style }}>{children}</div>;
}

function Box({
  x,
  y,
  w,
  d,
  ht,
  c,
  z = 0,
  front,
  side,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  ht: number;
  c: [string, string, string];
  z?: number;
  front?: ReactNode;
  side?: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformStyle: 'preserve-3d',
        transform: `translateZ(${z}px)`,
      }}
    >
      <Face
        style={{
          left: x,
          top: y,
          width: w,
          height: d,
          background: c[0],
          transform: `translateZ(${ht}px)`,
        }}
      />
      <Face
        style={{
          left: x,
          top: y + d - ht,
          width: w,
          height: ht,
          background: c[1],
          transformOrigin: '50% 100%',
          transform: 'rotateX(-90deg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {front}
      </Face>
      <Face
        style={{
          left: x,
          top: y,
          width: ht,
          height: d,
          background: side ?? c[2],
          transformOrigin: '0 50%',
          transform: 'rotateY(-90deg)',
        }}
      />
    </div>
  );
}

export function Street({ active, dotP }: { active: number; dotP: number }) {
  const S = STREET_SPACING;
  const L = (4 * S + 900) * Math.SQRT2;
  return (
    <>
      <Face
        style={{
          left: -1400,
          top: -1400,
          width: 4600,
          height: 4600,
          background: '#e4dccd',
          backgroundImage:
            'linear-gradient(#dcd3c2 1px,transparent 1px),linear-gradient(90deg,#dcd3c2 1px,transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />
      <Face
        style={{
          left: -450,
          top: -450 - 36,
          width: L,
          height: 72,
          background: '#cfc5b3',
          transformOrigin: '0 50%',
          transform: 'rotateZ(45deg) translateZ(1px)',
        }}
      />
      {Array.from({ length: 41 }, (_, k) => {
        const t = k / 10;
        const on = t <= dotP + 0.001;
        return (
          <Face
            key={k}
            style={{
              left: t * S - 5,
              top: t * S - 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: on ? '#e0773a' : '#b9ae9a',
              transform: 'translateZ(2px)',
              transition: 'background .3s',
            }}
          />
        );
      })}
      {BUILD.map((b, i) => {
        const o = OFF[i]!;
        const lx = i * S + o;
        const ly = i * S - o;
        const x = -b.w / 2;
        const y = -b.d / 2;
        const front = (
          <>
            <div
              style={{
                margin: '12px 12px 0',
                padding: '5px 6px',
                background: b.sb,
                color: b.si,
                font: '800 11px/1 var(--font-hanken), sans-serif',
                letterSpacing: '.1em',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {b.sign}
            </div>
            <div style={{ flex: 1, margin: '10px 12px 0', background: b.win }} />
            <div
              style={{
                alignSelf: 'center',
                width: 34,
                height: Math.min(52, b.h * 0.4),
                background: 'rgba(0,0,0,.35)',
                marginTop: -Math.min(52, b.h * 0.4),
              }}
            />
          </>
        );
        const on = i === active;
        return (
          <div
            key={i}
            style={{ position: 'absolute', left: lx, top: ly, transformStyle: 'preserve-3d' }}
          >
            <Face
              style={{
                left: -170,
                top: -170,
                width: 340,
                height: 340,
                background: '#efe9de',
                border: '1px solid #d8cfbf',
                transform: 'translateZ(1.5px)',
              }}
            />
            <Box x={x} y={y} w={b.w} d={b.d} ht={b.h} c={b.c} front={front} side={b.sw} />
            {b.ex.map((e, k) => (
              <Box key={k} x={e[0]} y={e[1]} w={e[2]} d={e[3]} ht={e[4]} z={e[5]} c={e[6]} />
            ))}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transformStyle: 'preserve-3d',
                transform: `translateZ(${b.h + 60}px) rotateZ(45deg) rotateX(-58deg)`,
              }}
            >
              <div
                className={on ? styles.pinBob : undefined}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transform: 'translate(-50%,-100%)',
                  opacity: on ? 1 : 0,
                  transition: 'opacity .5s',
                }}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: '10px 14px',
                    boxShadow: '0 14px 30px -10px rgba(40,30,20,.35)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    font: '500 13px var(--font-hanken), sans-serif',
                    color: '#1c1a17',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono), monospace',
                      fontSize: 11,
                      color: '#c4581f',
                    }}
                  >
                    BOOKED · {b.pin[0]}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{b.pin[1]}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
