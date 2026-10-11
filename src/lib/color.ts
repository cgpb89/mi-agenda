/**
 * Small color helpers for business brand colors (pure, client-safe).
 * Contrast follows WCAG 2.x relative luminance.
 */
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG contrast ratio between two #rrggbb colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white text, whichever reads better on `bg`. */
export function inkFor(bg: string): '#111111' | '#ffffff' {
  return contrastRatio(bg, '#111111') >= contrastRatio(bg, '#ffffff') ? '#111111' : '#ffffff';
}
