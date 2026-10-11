import type { Messages } from '@/i18n/messages';

/** Business categories ↔ booking templates. Labels live in `t.common.categories/templates`. */
export const CATEGORY_VALUES = ['BARBER', 'WELLNESS', 'CONSULT', 'FITNESS', 'SERVICES'] as const;

export type CategoryValue = (typeof CATEGORY_VALUES)[number];

function isCategory(v: string): v is CategoryValue {
  return (CATEGORY_VALUES as readonly string[]).includes(v);
}

export function categoryLabel(v: string, t: Messages): string {
  return isCategory(v) ? t.common.categories[v] : v;
}

export function templateLabel(v: string, t: Messages): string {
  return isCategory(v) ? t.common.templates[v] : v;
}
