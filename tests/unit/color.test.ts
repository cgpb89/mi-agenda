import { describe, expect, it } from 'vitest';
import { HEX_COLOR, contrastRatio, inkFor } from '@/lib/color';

describe('brand color helpers', () => {
  it('validates #rrggbb only', () => {
    expect(HEX_COLOR.test('#d6a15c')).toBe(true);
    expect(HEX_COLOR.test('#D6A15C')).toBe(true);
    expect(HEX_COLOR.test('d6a15c')).toBe(false);
    expect(HEX_COLOR.test('#fff')).toBe(false);
    expect(HEX_COLOR.test('red')).toBe(false);
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBe(contrastRatio('#000000', '#ffffff'));
  });

  it('picks readable text for a background', () => {
    expect(inkFor('#c8f542')).toBe('#111111'); // lime → dark text
    expect(inkFor('#1f5fbf')).toBe('#ffffff'); // blue → white text
    expect(inkFor('#d6a15c')).toBe('#111111');
  });
});
