import {
  Anton,
  Archivo,
  Bricolage_Grotesque,
  Cormorant_Garamond,
  Hanken_Grotesk,
  JetBrains_Mono,
  Jost,
  Public_Sans,
  Schibsted_Grotesk,
} from 'next/font/google';

/**
 * Fonts from the approved design system, self-hosted by next/font at build
 * time (no runtime requests to Google; keeps the CSP to 'self').
 * Template fonts are not preloaded — browsers only download them on pages that
 * use them (booking templates, the landing template switcher).
 */
export const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-bricolage',
  display: 'swap',
});
export const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});
export const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});
export const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
  preload: false,
});
export const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  // Variable font (300–700). Explicit weight lists trip a Turbopack dev bug
  // ("next/font/google queries have exactly one entry").
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
  preload: false,
});
export const jost = Jost({
  subsets: ['latin'],
  variable: '--font-jost',
  display: 'swap',
  preload: false,
});
export const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
  preload: false,
});
export const archivo = Archivo({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
  preload: false,
});
export const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
  display: 'swap',
  preload: false,
});

export const fontVariables = [
  bricolage,
  hanken,
  jetbrains,
  anton,
  cormorant,
  jost,
  publicSans,
  archivo,
  schibsted,
]
  .map((f) => f.variable)
  .join(' ');
