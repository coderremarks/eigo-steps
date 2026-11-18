import { defineConfig, devices } from '@playwright/test';

const PORT = 4188;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

/**
 * End-to-end tests run against the production build (`vite build` + `vite preview`), so they also
 * exercise the Content Security Policy, relative asset paths and lazy-loaded chunks that real
 * users get.
 *
 * Browser: CI uses Playwright's bundled Chromium. On a Windows dev machine the tests default to the
 * Microsoft Edge that ships with the OS, so no extra browser download is needed. Override with
 * PW_CHANNEL=chrome, or PW_CHANNEL=bundled to force Playwright's own Chromium.
 */
const requested = process.env.PW_CHANNEL;
const channel =
  requested === 'bundled'
    ? undefined
    : (requested ?? (process.platform === 'win32' && !isCI ? 'msedge' : undefined));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'Asia/Tokyo',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel },
    },
    {
      name: 'mobile',
      testIgnore: /screenshots\.spec\.ts/,
      grep: /@mobile/,
      use: { ...devices['Pixel 7'], channel },
    },
    {
      // Only on demand: `npm run screenshots` regenerates docs/screenshots.
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel,
        viewport: { width: 1280, height: 860 },
        // Lets the capture-only stylesheet (static header for full-page shots) apply under the CSP.
        bypassCSP: true,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
