import type { Messages } from './messages';

type ErrorMessages = Messages['errors'];
export type ErrorKey = keyof ErrorMessages;
type ParamsOf<K extends ErrorKey> = ErrorMessages[K] extends (p: infer P) => string
  ? [params: P]
  : [];

const MARK = '\u0001i18n:';

/**
 * A translatable server message. Server code throws/returns these tokens instead
 * of English text; they are resolved to the request's language at the boundary
 * (`toPublicError`, or `resolveMessage` for values returned as data).
 */
export function msg<K extends ErrorKey>(key: K, ...params: ParamsOf<K>): string {
  return `${MARK}${key}${params.length ? `:${JSON.stringify(params[0])}` : ''}`;
}

export function isMessageRef(text: string): boolean {
  return text.startsWith(MARK);
}

export function resolveMessage(text: string, t: Messages): string {
  if (!text.startsWith(MARK)) return text;
  const rest = text.slice(MARK.length);
  const sep = rest.indexOf(':');
  const key = (sep < 0 ? rest : rest.slice(0, sep)) as ErrorKey;
  const entry = t.errors[key] as string | ((p: unknown) => string) | undefined;
  if (entry === undefined) return t.errors.generic;
  if (typeof entry === 'string') return entry;
  return entry(sep < 0 ? {} : JSON.parse(rest.slice(sep + 1)));
}
