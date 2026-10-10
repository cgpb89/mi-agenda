import { defineConfig, devices } from '@playwright/test';
import { applyTestEnv, loadTestDbConfig } from './tests/support/test-db-guard';

/**
 * End-to-end journeys against a production build served on :3100, connected
 * to the guarded TEST database. Run `npm run db:test:reset` first.
 */
const cfg = loadTestDbConfig();
applyTestEnv(cfg);
const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      ...(process.env as Record<string, string>),
      NODE_ENV: 'production',
      APP_URL: `http://localhost:${PORT}`,
    },
  },
});
