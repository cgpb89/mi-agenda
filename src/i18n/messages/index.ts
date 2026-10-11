import type { Locale } from '../config';
import { en, type Messages } from './en';
import { es } from './es';

export type { Messages };

export const messages: Record<Locale, Messages> = { en, es };
