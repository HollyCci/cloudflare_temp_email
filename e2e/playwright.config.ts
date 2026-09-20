import { defineConfig, devices } from '@playwright/test';
import { adminHeaders } from './fixtures/access-token.ts';

const WORKER_BASE = process.env.WORKER_URL!;
const WORKER_GZIP_BASE = process.env.WORKER_GZIP_URL || '';
const FRONTEND_BASE = process.env.FRONTEND_URL!;

// Admin APIs are role-based. API projects authenticate every `request` call with an
// admin role token, which replaces the removed `DISABLE_ADMIN_PASSWORD_CHECK` shortcut.
// Per-request headers take precedence, so tests can override it. Note that
// `playwright.request.newContext()` inherits it as well: pass `extraHTTPHeaders: {}`
// to make anonymous calls. Worker variants with their own JWT secret need their own
// token (`ADMIN_HEADERS_ENV_OFF`, `SITE_ADMIN_HEADERS` in fixtures/test-helpers.ts).
const ADMIN_HEADERS = adminHeaders();

export default defineConfig({
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: WORKER_BASE,
        extraHTTPHeaders: ADMIN_HEADERS,
      },
    },
    {
      name: 'api-gzip',
      testDir: './tests/api-gzip',
      use: {
        baseURL: WORKER_GZIP_BASE,
        extraHTTPHeaders: ADMIN_HEADERS,
      },
    },
    {
      name: 'smtp-proxy',
      testDir: './tests/smtp-proxy',
      use: {
        baseURL: WORKER_BASE,
        extraHTTPHeaders: ADMIN_HEADERS,
      },
    },
    {
      name: 'browser',
      testDir: './tests/browser',
      use: {
        baseURL: FRONTEND_BASE,
        ...devices['Desktop Chrome'],
        // Accept self-signed cert from Docker frontend (HTTPS for WebAuthn)
        ignoreHTTPSErrors: true,
        // No extraHTTPHeaders here: browser tests get an admin `request` fixture from fixtures/test.ts
      },
    },
  ],
});
