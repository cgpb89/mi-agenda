import { describe, expect, it } from 'vitest';
import { normalizePhone, formatPhone } from '@/lib/phone';
import { AppError } from '@/lib/errors';
import {
  emailSchema,
  moneyInputSchema,
  parseInput,
  parseMoneyToMinor,
  RESERVED_SLUGS,
  slugify,
  slugSchema,
  cleanText,
} from '@/lib/validation';
import { safeRedirectPath as safeRedirectPathPure } from '@/lib/security/redirect';
import { pageContentSchema, readPageContent } from '@/modules/businesses/page-content';
import { signupSchema } from '@/modules/auth/schemas';

describe('phone normalisation', () => {
  it('normalises national numbers with an explicit country', () => {
    expect(normalizePhone('(202) 555-0142', 'US')).toEqual({
      ok: true,
      e164: '+12025550142',
      country: 'US',
    });
    expect(normalizePhone('612 345 678', 'ES')).toMatchObject({ ok: true, e164: '+34612345678' });
  });
  it('honours an explicit international prefix regardless of the selected country', () => {
    expect(normalizePhone('+44 20 7946 0958', 'US')).toMatchObject({
      ok: true,
      e164: '+442079460958',
    });
  });
  it('rejects invalid or missing numbers instead of pretending to normalise them', () => {
    expect(normalizePhone('', 'US')).toEqual({ ok: false, reason: 'missing' });
    expect(normalizePhone('12345', 'US')).toEqual({ ok: false, reason: 'invalid' });
    expect(normalizePhone('call me maybe', 'US')).toEqual({ ok: false, reason: 'invalid' });
    expect(normalizePhone('<script>', 'US')).toEqual({ ok: false, reason: 'invalid' });
    expect(normalizePhone('2025550142', 'ZZ')).toEqual({ ok: false, reason: 'invalid' });
  });
  it('the same number entered differently maps to the same key', () => {
    const a = normalizePhone('202-555-0142', 'US');
    const b = normalizePhone('+1 (202) 555 0142', 'GB');
    expect(a.ok && b.ok && a.e164 === b.e164).toBe(true);
  });
  it('formats E.164 for display', () => {
    expect(formatPhone('+12025550142')).toBe('+1 202 555 0142');
    expect(formatPhone(null)).toBe('');
  });
});

describe('slugs', () => {
  it('slugifies business names', () => {
    expect(slugify('Northside Barber Co.')).toBe('northside-barber-co');
    expect(slugify('Sable & Sage')).toBe('sable-and-sage');
    expect(slugify('Café Ñandú')).toBe('cafe-nandu');
  });
  it('validates format and reserved names', () => {
    expect(slugSchema.safeParse('northside-barber').success).toBe(true);
    expect(slugSchema.safeParse('ab').success).toBe(false);
    expect(slugSchema.safeParse('-bad').success).toBe(false);
    expect(slugSchema.safeParse('bad--slug').success).toBe(false);
    expect(slugSchema.safeParse('Has Spaces').success).toBe(false);
    for (const r of ['admin', 'api', 'login', 'super-admin']) {
      expect(RESERVED_SLUGS.has(r)).toBe(true);
      expect(slugSchema.safeParse(r).success).toBe(false);
    }
  });
});

describe('money and text input', () => {
  it('parses money as integer minor units without floats', () => {
    expect(parseMoneyToMinor('38')).toBe(3800);
    expect(parseMoneyToMinor('38.5')).toBe(3850);
    expect(parseMoneyToMinor('$0.10')).toBe(10);
    expect(parseMoneyToMinor('19.999')).toBeNull();
    expect(parseMoneyToMinor('-5')).toBeNull();
    expect(parseMoneyToMinor('1e3')).toBeNull();
    expect(moneyInputSchema.safeParse('12.34').data).toBe(1234);
  });
  it('normalises emails', () => {
    expect(emailSchema.parse('  Marcus@Northside.TEST ')).toBe('marcus@northside.test');
    expect(emailSchema.safeParse('nope').success).toBe(false);
  });
  it('strips control characters', () => {
    expect(cleanText('Hi\u0000 there\u0007')).toBe('Hi there');
  });
  it('throws client-safe validation errors with field messages', () => {
    try {
      parseInput(signupSchema, { name: '', email: 'x', password: 'short' });
      throw new Error('expected failure');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const err = e as AppError;
      expect(err.code).toBe('VALIDATION');
      expect(Object.keys(err.fieldErrors ?? {})).toEqual(
        expect.arrayContaining(['email', 'password']),
      );
    }
  });
});

describe('page content JSON', () => {
  it('accepts valid content and drops invalid stored values on read', () => {
    expect(
      pageContentSchema.safeParse({
        headline: 'Hi',
        highlights: [{ title: 'Face', body: 'Facials' }],
      }).success,
    ).toBe(true);
    expect(
      pageContentSchema.safeParse({ highlights: new Array(4).fill({ title: 'a', body: 'b' }) })
        .success,
    ).toBe(false);
    expect(readPageContent({ headline: 42 })).toEqual({});
    expect(readPageContent(null)).toEqual({});
  });
});

describe('redirect safety', () => {
  it('only allows internal paths', () => {
    expect(safeRedirectPathPure('/app/x')).toBe('/app/x');
    expect(safeRedirectPathPure('https://evil.example')).toBe('/app');
    expect(safeRedirectPathPure('//evil.example')).toBe('/app');
    expect(safeRedirectPathPure('/\\evil.example')).toBe('/app');
    expect(safeRedirectPathPure(undefined)).toBe('/app');
  });
});
