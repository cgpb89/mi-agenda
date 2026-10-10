/**
 * Minimal structured JSON logger with defensive redaction. Callers should never
 * pass secrets; keys that look sensitive are masked anyway.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /pass(word)?|secret|token|cookie|authorization|session|phone|email|card/i;

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redactForLog(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redactForLog(v, depth + 1);
    }
    return out;
  }
  return value;
}

function threshold(): number {
  const lvl = process.env.LOG_LEVEL as Level | undefined;
  return lvl && lvl in order ? order[lvl] : order.info;
}

function emit(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test' && !process.env.LOG_IN_TESTS) return;
  if (order[level] < threshold()) return;
  const payload = ctx ? (redactForLog(ctx) as Record<string, unknown>) : {};
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...payload });
  if (level === 'error' || level === 'warn') console.error(line);
  else process.stdout.write(line + '\n');
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
};
