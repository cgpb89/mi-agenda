import { describe, expect, it } from 'vitest';
import { DEPOSIT_REFERENCE, depositFor, normalizeDepositReference } from '@/modules/deposits/rules';

const sinpe = '+506 8888 8888';

describe('SINPE deposits', () => {
  it('asks nothing when off, without a SINPE number, or for free services', () => {
    expect(depositFor({ mode: 'NONE', value: 0, sinpePhone: sinpe }, 700000, 'CRC')).toBeNull();
    expect(
      depositFor({ mode: 'FIXED', value: 200000, sinpePhone: null }, 700000, 'CRC'),
    ).toBeNull();
    expect(depositFor({ mode: 'FIXED', value: 200000, sinpePhone: sinpe }, 0, 'CRC')).toBeNull();
  });

  it('uses a fixed amount, capped at the price', () => {
    expect(depositFor({ mode: 'FIXED', value: 200000, sinpePhone: sinpe }, 700000, 'CRC')).toBe(
      200000,
    );
    expect(depositFor({ mode: 'FIXED', value: 900000, sinpePhone: sinpe }, 700000, 'CRC')).toBe(
      700000,
    );
  });

  it('rounds percentages to ₡100 (colones) or 1 unit (other currencies)', () => {
    // 30% of ₡7 000 = ₡2 100
    expect(depositFor({ mode: 'PERCENT', value: 30, sinpePhone: sinpe }, 700000, 'CRC')).toBe(
      210000,
    );
    // 33% of ₡4 500 = ₡1 485 → ₡1 500
    expect(depositFor({ mode: 'PERCENT', value: 33, sinpePhone: sinpe }, 450000, 'CRC')).toBe(
      150000,
    );
    // 50% of $45 = $22.50 → $23
    expect(depositFor({ mode: 'PERCENT', value: 50, sinpePhone: sinpe }, 4500, 'USD')).toBe(2300);
    // tiny percentages still ask at least one step
    expect(depositFor({ mode: 'PERCENT', value: 1, sinpePhone: sinpe }, 700000, 'CRC')).toBe(10000);
  });

  it('validates and normalizes SINPE references', () => {
    expect(normalizeDepositReference(' 2026 1011 5531 ')).toBe('202610115531');
    expect(DEPOSIT_REFERENCE.test('202610115531')).toBe(true);
    expect(DEPOSIT_REFERENCE.test('AB-12')).toBe(true);
    expect(DEPOSIT_REFERENCE.test('123')).toBe(false);
    expect(DEPOSIT_REFERENCE.test('12<script>')).toBe(false);
  });
});
