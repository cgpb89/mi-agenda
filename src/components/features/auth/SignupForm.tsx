'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { signupAction, type FormState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, formStyles } from '@/components/ui/Form';
import { PHONE_COUNTRIES } from '@/lib/phone/countries';
import { CATEGORY_VALUES } from '@/components/features/shared/categories';
import styles from './Auth.module.scss';
import { useI18n } from '@/i18n/client';
import { countryName } from '@/i18n/format';

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

const FALLBACK_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Madrid',
];

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, {});
  const fe = state.error?.fieldErrors ?? {};
  const v = state.values ?? {};
  const [business, setBusiness] = useState(v.businessName ?? '');
  const [slug, setSlug] = useState(v.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(v.slug));
  const tzRef = useRef<HTMLSelectElement>(null);
  const { t, locale } = useI18n();
  const s = t.auth.signup;

  // Pre-select the browser's time zone after hydration (DOM update, no re-render).
  useEffect(() => {
    if (v.timezone || !tzRef.current) return;
    try {
      const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (guess && [...tzRef.current.options].some((o) => o.value === guess))
        tzRef.current.value = guess;
    } catch {
      /* keep default */
    }
  }, [v.timezone]);

  const zones = useMemo(() => {
    try {
      return (
        (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
          'timeZone',
        ) ?? FALLBACK_ZONES
      );
    } catch {
      return FALLBACK_ZONES;
    }
  }, []);

  return (
    <form action={action} className={styles.form} noValidate>
      {state.error ? <FormMessage kind="error">{state.error.message}</FormMessage> : null}

      <div className={formStyles.grid2}>
        <Field label={t.auth.yourName} error={fe.name}>
          {(p) => (
            <Input
              {...p}
              name="name"
              autoComplete="name"
              required
              defaultValue={v.name ?? ''}
              placeholder={s.namePlaceholder}
            />
          )}
        </Field>
        <Field label={t.auth.email} error={fe.email}>
          {(p) => (
            <Input
              {...p}
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={v.email ?? ''}
            />
          )}
        </Field>
      </div>
      <Field label={t.auth.password} hint={t.auth.atLeast10} error={fe.password}>
        {(p) => (
          <Input
            {...p}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
          />
        )}
      </Field>

      <div className={styles.section}>
        <span className={styles.legend}>{s.yourBusiness}</span>
        <Field label={s.businessName} error={fe.businessName}>
          {(p) => (
            <Input
              {...p}
              name="businessName"
              required
              value={business}
              placeholder={s.businessPlaceholder}
              onChange={(e) => {
                setBusiness(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          )}
        </Field>
        <Field label={s.slug} error={fe.slug}>
          {(p) => (
            <Input
              {...p}
              name="slug"
              required
              value={slug}
              placeholder={s.slugPlaceholder}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
            />
          )}
        </Field>
        <span className={styles.slugPreview}>tempo/book/{slug || s.slugFallback}</span>
        <div className={formStyles.grid2}>
          <Field label={s.category} error={fe.category}>
            {(p) => (
              <Select {...p} name="category" defaultValue={v.category ?? 'BARBER'}>
                {CATEGORY_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {t.common.categories[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={s.country} error={fe.country}>
            {(p) => (
              <Select {...p} name="country" defaultValue={v.country ?? 'US'}>
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {countryName(c.code, locale, c.name)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={s.timezone} hint={s.timezoneHint} error={fe.timezone}>
          {(p) => (
            <Select
              {...p}
              ref={tzRef}
              name="timezone"
              defaultValue={v.timezone ?? 'America/New_York'}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? s.submitting : s.submit}
      </Button>
      <div className={styles.footer}>
        <span>
          {s.haveAccount} <Link href="/login">{s.signIn}</Link>
        </span>
      </div>
    </form>
  );
}
