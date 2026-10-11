/**
 * Booking-flow theme tokens — transcribed from design/project/Booking Flow.dc.html (`T`)
 * plus the per-template copy (`B`). Fonts resolve to the self-hosted next/font variables.
 */
export type TemplateKey = 'barber' | 'wellness' | 'consult' | 'fitness' | 'services';

export interface FlowTheme {
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentInk: string;
  font: string;
  display: string;
  titleSize: string;
  titleWeight: string;
  titleStyle: string;
  upper: string;
  titleTrack: string;
  stretch: string;
  radius: string;
  panelRadius: string;
  slotOff: string;
  field: string;
  error: string;
  sel: string;
}

const HANKEN = "var(--font-hanken), 'Hanken Grotesk', sans-serif";
const ANTON = "var(--font-anton), 'Anton', sans-serif";
const JOST = "var(--font-jost), 'Jost', sans-serif";
const CORMORANT = "var(--font-cormorant), 'Cormorant Garamond', serif";
const PUBLIC_SANS = "var(--font-public-sans), 'Public Sans', sans-serif";
const ARCHIVO = "var(--font-archivo), 'Archivo', sans-serif";
const SCHIBSTED = "var(--font-schibsted), 'Schibsted Grotesk', sans-serif";

export const THEMES: Record<TemplateKey, FlowTheme> = {
  barber: {
    surface: '#1f1a16',
    ink: '#f3ece2',
    muted: '#b0a393',
    line: 'rgba(243,236,226,.16)',
    accent: '#d6a15c',
    accentInk: '#1b1714',
    font: HANKEN,
    display: ANTON,
    titleSize: '30px',
    titleWeight: '400',
    titleStyle: 'normal',
    upper: 'uppercase',
    titleTrack: '.01em',
    stretch: 'normal',
    radius: '2px',
    panelRadius: '4px',
    slotOff: 'rgba(243,236,226,.04)',
    field: '#2a2420',
    error: '#ff8a7a',
    sel: 'rgba(214,161,92,.12)',
  },
  wellness: {
    surface: '#fbf8f2',
    ink: '#3a3128',
    muted: '#7d7064',
    line: '#e4dacb',
    accent: '#7f6545',
    accentInk: '#fbf8f2',
    font: JOST,
    display: CORMORANT,
    titleSize: '34px',
    titleWeight: '500',
    titleStyle: 'italic',
    upper: 'none',
    titleTrack: '0',
    stretch: 'normal',
    radius: '999px',
    panelRadius: '22px',
    slotOff: '#f1ebe1',
    field: '#fff',
    error: '#a8432f',
    sel: '#f1e8da',
  },
  consult: {
    surface: '#ffffff',
    ink: '#14233a',
    muted: '#5a6a80',
    line: '#dbe3ee',
    accent: '#1f5fbf',
    accentInk: '#ffffff',
    font: PUBLIC_SANS,
    display: PUBLIC_SANS,
    titleSize: '22px',
    titleWeight: '700',
    titleStyle: 'normal',
    upper: 'none',
    titleTrack: '-.01em',
    stretch: 'normal',
    radius: '8px',
    panelRadius: '12px',
    slotOff: '#f2f5f9',
    field: '#fff',
    error: '#b42318',
    sel: '#eaf1fc',
  },
  fitness: {
    surface: '#15160f',
    ink: '#f2f5ea',
    muted: '#a3a896',
    line: 'rgba(242,245,234,.16)',
    accent: '#c8f542',
    accentInk: '#0e0f0c',
    font: ARCHIVO,
    display: ARCHIVO,
    titleSize: '34px',
    titleWeight: '900',
    titleStyle: 'italic',
    upper: 'uppercase',
    titleTrack: '-.01em',
    stretch: '70%',
    radius: '0px',
    panelRadius: '0px',
    slotOff: 'rgba(242,245,234,.04)',
    field: '#1d1f16',
    error: '#ff7b6b',
    sel: 'rgba(200,245,66,.12)',
  },
  services: {
    surface: '#ffffff',
    ink: '#1d1f22',
    muted: '#62666d',
    line: '#e3e3df',
    accent: '#d9532a',
    accentInk: '#ffffff',
    font: SCHIBSTED,
    display: SCHIBSTED,
    titleSize: '24px',
    titleWeight: '800',
    titleStyle: 'normal',
    upper: 'none',
    titleTrack: '-.02em',
    stretch: 'normal',
    radius: '10px',
    panelRadius: '16px',
    slotOff: '#f3f3f1',
    field: '#fff',
    error: '#b42318',
    sel: '#fbeee8',
  },
};
