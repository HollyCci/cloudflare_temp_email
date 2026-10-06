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

test('authentication errors keep their CORS headers', async ({ request }) => {
  const mailbox = await request.get(`${WORKER_URL}/api/settings`, { headers: { 'x-lang': 'en' } });
  expect(mailbox.status()).toBe(401);
  expect(mailbox.headers()['content-type']).toContain('text/plain');
  expect(mailbox.headers()['access-control-allow-origin']).toBe('*');
  expect(await mailbox.text()).toBe('Invalid address credential');

  // an account error is structured, so that the frontend can sign the account out
  const account = await request.get(`${WORKER_URL}/user_api/settings`, { headers: { 'x-lang': 'en' } });
  expect(account.status()).toBe(401);
  expect(account.headers()['content-type']).toContain('application/json');
  expect(account.headers()['access-control-allow-origin']).toBe('*');
  expect(await account.json()).toEqual({
    code: 'AUTH_USER_TOKEN_INVALID',
    message: 'Your sign-in is no longer valid, please sign in again',
  });
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
