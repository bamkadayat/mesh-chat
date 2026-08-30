import { defineConfig } from '@playwright/test';

/**
 * Ports deliberately differ from the development ones, so a running `pnpm dev`
 * does not make the suite pass or fail for the wrong reason.
 */
const CLIENT_PORT = 5273;
const SERVER_PORT = 3101;
const CLIENT_URL = `http://localhost:${String(CLIENT_PORT)}`;

export default defineConfig({
  testDir: './e2e',
  /** Real WebRTC negotiation is slower than a DOM assertion. */
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: CLIENT_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: `pnpm exec tsx server/src/index.ts`,
      env: { PORT: String(SERVER_PORT), CLIENT_ORIGIN: CLIENT_URL },
      port: SERVER_PORT,
      reuseExistingServer: false,
    },
    {
      /** host is required: Vite binds IPv6 loopback only without it. */
      command: `pnpm exec vite --config frontend/vite.config.ts --host --port ${String(CLIENT_PORT)} --strictPort`,
      env: { VITE_SIGNALING_URL: `http://localhost:${String(SERVER_PORT)}` },
      port: CLIENT_PORT,
      reuseExistingServer: false,
    },
  ],
});
