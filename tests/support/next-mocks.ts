/**
 * Minimal stand-ins for Next.js request APIs so server actions and services
 * can be exercised directly in integration tests (real DB, no HTTP server).
 */
const jar = new Map<string, string>();
let requestHeaders = new Headers({ 'user-agent': 'vitest', origin: 'http://localhost:3100' });

export const testRequest = {
  setCookie(name: string, value: string) {
    jar.set(name, value);
  },
  clearCookies() {
    jar.clear();
  },
  getCookie(name: string) {
    return jar.get(name);
  },
  setHeaders(h: Record<string, string>) {
    requestHeaders = new Headers({ 'user-agent': 'vitest', ...h });
  },
};

export async function cookies() {
  return {
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
    has: (name: string) => jar.has(name),
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
  };
}

export async function headers() {
  return requestHeaders;
}
