/** Only allow internal, path-only redirect targets (prevents open redirects). */
export function safeRedirectPath(target: string | null | undefined, fallback = '/app'): string {
  if (!target) return fallback;
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\'))
    return fallback;
  if (/[\r\n]/.test(target)) return fallback;
  return target;
}
