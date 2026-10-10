/** Business categories ↔ booking templates (labels from the design). */
export const CATEGORY_OPTIONS = [
  { value: 'BARBER', label: 'Barber & hair', template: 'Barber' },
  { value: 'WELLNESS', label: 'Beauty & wellness', template: 'Wellness' },
  { value: 'CONSULT', label: 'Health & consultation', template: 'Consultation' },
  { value: 'FITNESS', label: 'Fitness & coaching', template: 'Fitness' },
  { value: 'SERVICES', label: 'General services', template: 'General services' },
] as const;

export type CategoryValue = (typeof CATEGORY_OPTIONS)[number]['value'];

export function categoryLabel(v: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === v)?.label ?? v;
}

export function templateLabel(v: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === v)?.template ?? v;
}
