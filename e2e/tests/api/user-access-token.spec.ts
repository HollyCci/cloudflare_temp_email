import { test, expect } from '@playwright/test';
import { E2E_JWT_SECRET_SITE_PASSWORD, SITE_HEADERS, WORKER_URL, WORKER_URL_SITE_PASSWORD, signAccessToken } from '../../fixtures/test-helpers';

for (const scenario of ['expired role', 'valid role', 'invalid signature', 'missing expiry', 'non-admin role', 'missing token'] as const) {
  test(`Admin role token errors stay distinct: ${scenario}`, async ({ playwright }) => {
    const token = signAccessToken({
      user_id: 1,
      user_role: scenario === 'non-admin role' ? 'case-role' : 'admin',
      exp: scenario === 'missing expiry' ? undefined
        : Math.floor(Date.now() / 1000) + (scenario === 'expired role' ? -60 : 3600),
    }, scenario === 'invalid signature' ? 'wrong-secret' : E2E_JWT_SECRET_SITE_PASSWORD);
    const headers: Record<string, string> = { ...SITE_HEADERS, 'x-lang': 'en' };
    if (scenario !== 'missing token') headers['x-user-access-token'] = token;
    // newContext() inherits the project-level admin header; clear it so only the scenario's headers apply.
    const client = await playwright.request.newContext({ extraHTTPHeaders: {} });
    try {
      const response = await client.get(`${WORKER_URL_SITE_PASSWORD}/admin/db_version`, { headers });
      if (scenario === 'expired role') {
        expect(response.status()).toBe(401);
        expect(await response.json()).toEqual({
          code: 'AUTH_USER_ACCESS_TOKEN_EXPIRED',
          message: 'Your access token has expired, please refresh the page',
        });
      } else if (scenario === 'missing expiry') {
        expect(response.status()).toBe(401);
        expect(await response.json()).toEqual({
          code: 'AUTH_ADMIN_CREDENTIAL_INVALID',
          message: 'Your access token has expired, please refresh the page',
        });
      } else if (scenario === 'valid role') {
        expect(response.ok()).toBe(true);
      } else if (scenario === 'non-admin role') {
        expect(response.status()).toBe(401);
        expect(await response.json()).toEqual({
          code: 'AUTH_ADMIN_CREDENTIAL_INVALID',
          message: 'Your user role is not admin, no access to visit this page',
        });
      } else {
        expect(response.status()).toBe(401);
        expect(await response.json()).toEqual({
          code: 'AUTH_ADMIN_CREDENTIAL_INVALID',
          message: 'Sign in with an admin account to access this page',
        });
      }
    } finally {
      await client.dispose();
    }
  });
}

test('generic authentication errors preserve their text messages and CORS headers', async ({ request }) => {
  for (const { path, message } of [
    { path: '/api/settings', message: 'Invalid address credential' },
    { path: '/user_api/settings', message: 'Your token has expired, please login again' },
  ]) {
    const response = await request.get(`${WORKER_URL}${path}`, { headers: { 'x-lang': 'en' } });
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('text/plain');
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    expect(await response.text()).toBe(message);
  }
});

test('uncaught server errors return JSON with the original error detail', async ({ request }) => {
  const response = await request.post(`${WORKER_URL}/open_api/site_login`, {
    headers: { 'content-type': 'application/json' },
    data: Buffer.from('{invalid-json'),
  });
  expect(response.status()).toBe(500);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toEqual({ code: 'INTERNAL_SERVER_ERROR', message: expect.stringContaining('SyntaxError') });
});
