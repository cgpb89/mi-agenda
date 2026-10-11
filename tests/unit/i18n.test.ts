import { describe, expect, it } from 'vitest';
import { negotiateLocale, toLocale } from '@/i18n/config';
import { formatMinutesOfDay, formatPrice } from '@/i18n/format';
import { msg, resolveMessage } from '@/i18n/message-ref';
import { messages } from '@/i18n/messages';
import { AppError, toPublicError } from '@/lib/errors';
import { parseInput, nameSchema } from '@/lib/validation';
import { summarizeHours } from '@/modules/public/booking-page-pure';
import { z } from 'zod';

describe('locale negotiation', () => {
  it('maps regional tags to supported locales', () => {
    expect(toLocale('es-AR')).toBe('es');
    expect(toLocale('EN_us')).toBe('en');
    expect(toLocale('fr')).toBeNull();
    expect(toLocale(undefined)).toBeNull();
  });

  it('picks the best Accept-Language match by quality', () => {
    expect(negotiateLocale('es-UY,es;q=0.9,en;q=0.8')).toBe('es');
    expect(negotiateLocale('fr-FR,fr;q=0.9,es;q=0.5,en;q=0.7')).toBe('en');
    expect(negotiateLocale('de,fr')).toBe('en');
    expect(negotiateLocale('es;q=0,en;q=0.1')).toBe('en');
    expect(negotiateLocale(null)).toBe('en');
  });
});

describe('server messages', () => {
  it('resolves message tokens per language and leaves plain text alone', () => {
    expect(resolveMessage(msg('slotTaken'), messages.en)).toBe(messages.en.errors.slotTaken);
    expect(resolveMessage(msg('slotTaken'), messages.es)).toBe(messages.es.errors.slotTaken);
    expect(resolveMessage(msg('phoneLimitMany', { max: 3 }), messages.es)).toContain('3');
    expect(resolveMessage('limit', messages.es)).toBe('limit');
  });

  it('translates AppError messages and field errors at the boundary', () => {
    const err = new AppError('CONFLICT', msg('emailExists'), {
      fieldErrors: { email: msg('emailExistsField'), slot: 'booked' },
    });
    const pub = toPublicError(err, 'es');
    expect(pub.message).toBe(messages.es.errors.emailExists);
    expect(pub.fieldErrors).toEqual({ email: messages.es.errors.emailExistsField, slot: 'booked' });
  });

  it('translates validation messages with parameters', () => {
    let caught: unknown;
    try {
      parseInput(z.object({ name: nameSchema('businessName', 5) }), { name: 'Too long a name' });
    } catch (e) {
      caught = e;
    }
    const pub = toPublicError(caught, 'es');
    expect(pub.fieldErrors?.name).toBe(
      messages.es.errors.fieldTooLong({ field: 'businessName', max: 5 }),
    );
  });

  it('never leaks unknown errors in either language', () => {
    expect(toPublicError(new Error('db exploded'), 'es').message).toBe(messages.es.errors.generic);
  });
});

describe('formatting', () => {
  it('formats times and prices per locale', () => {
    expect(formatMinutesOfDay(9 * 60, 'en')).toBe('9:00 AM');
    expect(formatMinutesOfDay(19 * 60 + 30, 'es')).toMatch(/^7:30/);
    expect(formatPrice(3800, 'USD', 'en')).toBe('$38');
    expect(formatPrice(3850, 'UYU', 'es')).toBe('$38.50');
  });

  it('summarises business hours in the page language', () => {
    const rules = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startMin: 540, endMin: 1020 }));
    expect(summarizeHours(rules, 'en')[1]).toBe('Sat, Sun closed');
    expect(summarizeHours(rules, 'es')[1]).toContain('cerrado');
  });
});
