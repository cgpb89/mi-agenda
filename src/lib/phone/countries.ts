/**
 * Countries offered in the phone-number country selector. Client-safe (no
 * libphonenumber metadata). Any other country can still be entered by typing
 * the full international number starting with "+".
 */
export interface PhoneCountry {
  code: string;
  name: string;
  dial: string;
}

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { code: 'US', name: 'United States', dial: '+1' },
  { code: 'CA', name: 'Canada', dial: '+1' },
  { code: 'MX', name: 'Mexico', dial: '+52' },
  // Central America and the Caribbean
  { code: 'CR', name: 'Costa Rica', dial: '+506' },
  { code: 'PA', name: 'Panama', dial: '+507' },
  { code: 'NI', name: 'Nicaragua', dial: '+505' },
  { code: 'HN', name: 'Honduras', dial: '+504' },
  { code: 'SV', name: 'El Salvador', dial: '+503' },
  { code: 'GT', name: 'Guatemala', dial: '+502' },
  { code: 'BZ', name: 'Belize', dial: '+501' },
  { code: 'DO', name: 'Dominican Republic', dial: '+1' },
  { code: 'PR', name: 'Puerto Rico', dial: '+1' },
  { code: 'GB', name: 'United Kingdom', dial: '+44' },
  { code: 'IE', name: 'Ireland', dial: '+353' },
  { code: 'ES', name: 'Spain', dial: '+34' },
  { code: 'PT', name: 'Portugal', dial: '+351' },
  { code: 'FR', name: 'France', dial: '+33' },
  { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'IT', name: 'Italy', dial: '+39' },
  { code: 'NL', name: 'Netherlands', dial: '+31' },
  { code: 'BE', name: 'Belgium', dial: '+32' },
  { code: 'CH', name: 'Switzerland', dial: '+41' },
  { code: 'AT', name: 'Austria', dial: '+43' },
  { code: 'SE', name: 'Sweden', dial: '+46' },
  { code: 'NO', name: 'Norway', dial: '+47' },
  { code: 'DK', name: 'Denmark', dial: '+45' },
  { code: 'FI', name: 'Finland', dial: '+358' },
  { code: 'PL', name: 'Poland', dial: '+48' },
  { code: 'AR', name: 'Argentina', dial: '+54' },
  { code: 'BR', name: 'Brazil', dial: '+55' },
  { code: 'CL', name: 'Chile', dial: '+56' },
  { code: 'CO', name: 'Colombia', dial: '+57' },
  { code: 'EC', name: 'Ecuador', dial: '+593' },
  { code: 'BO', name: 'Bolivia', dial: '+591' },
  { code: 'PY', name: 'Paraguay', dial: '+595' },
  { code: 'PE', name: 'Peru', dial: '+51' },
  { code: 'UY', name: 'Uruguay', dial: '+598' },
  { code: 'VE', name: 'Venezuela', dial: '+58' },
  { code: 'AU', name: 'Australia', dial: '+61' },
  { code: 'NZ', name: 'New Zealand', dial: '+64' },
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'JP', name: 'Japan', dial: '+81' },
  { code: 'SG', name: 'Singapore', dial: '+65' },
  { code: 'ZA', name: 'South Africa', dial: '+27' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { code: 'IL', name: 'Israel', dial: '+972' },
];
