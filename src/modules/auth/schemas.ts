import { z } from 'zod';
import { countryCodeSchema } from '@/lib/phone';
import {
  emailSchema,
  nameSchema,
  passwordSchema,
  slugSchema,
  timeZoneSchema,
} from '@/lib/validation';

export const CATEGORIES = ['BARBER', 'WELLNESS', 'CONSULT', 'FITNESS', 'SERVICES'] as const;
export type Category = (typeof CATEGORIES)[number];

export const signupSchema = z.object({
  name: nameSchema('name'),
  email: emailSchema,
  password: passwordSchema,
  businessName: nameSchema('business name', 120),
  slug: slugSchema,
  category: z.enum(CATEGORIES, { error: 'Choose a category' }),
  timezone: timeZoneSchema,
  country: countryCodeSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // Do not apply strength rules on login (only on set) — just bound the size.
  password: z.string().min(1, 'Enter your password').max(200),
});

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z
  .object({
    token: z.string().min(20).max(128),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });
