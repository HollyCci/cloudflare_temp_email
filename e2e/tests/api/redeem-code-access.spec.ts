import { expect, test } from '@playwright/test';
import {
  ADMIN_HEADERS_ENV_OFF,
  E2E_JWT_SECRET_SITE_PASSWORD,
  SITE_ADMIN_HEADERS,
  SITE_HEADERS,
  WORKER_URL_ENV_OFF,
  WORKER_URL_SITE_PASSWORD,
  signAccessToken,
} from '../../fixtures/test-helpers';

// The site-password worker signs tokens with its own secret; the project-level admin
// header (default secret) is not valid there, so every admin call passes these explicitly.
const ADMIN_HEADERS = SITE_ADMIN_HEADERS;
const futureExpiration = () => new Date(Date.now() + 3_600_000).toISOString();

const signTestToken = (payload: Record<string, unknown>, secret = E2E_JWT_SECRET_SITE_PASSWORD) =>
  signAccessToken(payload, secret);

const tokenPayload = (role: string) => ({
  user_id: 1,
  user_role: role,
  exp: Math.floor(Date.now() / 1000) + 3600,
});

test.describe('Redemption feature access boundaries', () => {
  test('the disabled switch hides every user and Admin endpoint', async ({ request }) => {
    const settingsResponse = await request.get(`${WORKER_URL_ENV_OFF}/open_api/settings`);
    expect(settingsResponse.ok()).toBe(true);
    expect((await settingsResponse.json()).enableRedeemCode).toBe(false);

    // The env-off worker has its own JWT secret, so admin calls need its admin token.
    const headers = ADMIN_HEADERS_ENV_OFF;
    const requests = [
      request.post(`${WORKER_URL_ENV_OFF}/redeem_api/query`, { data: { code: 'anything' } }),
      request.post(`${WORKER_URL_ENV_OFF}/redeem_api/result`, { data: { code: 'anything' } }),
      request.post(`${WORKER_URL_ENV_OFF}/redeem_api/redeem`, {
        data: { code: 'anything', user_email: 'user@test.example.com' },
      }),
      request.get(`${WORKER_URL_ENV_OFF}/admin/redeem_codes?redeem_type=role`, { headers }),
      request.get(`${WORKER_URL_ENV_OFF}/admin/redeem_codes/export?redeem_type=role&limit=1`, { headers }),
      request.post(`${WORKER_URL_ENV_OFF}/admin/redeem_codes/batch`, {
        headers,
        data: {
          count: 1,
          redeem_type: 'role',
          value: 'case-role',
          enabled: true,
          expires_at: futureExpiration(),
        },
      }),
      request.put(`${WORKER_URL_ENV_OFF}/admin/redeem_codes/1`, {
        headers,
        data: {
          redeem_type: 'role',
          value: 'case-role',
          enabled: true,
          expires_at: futureExpiration(),
        },
      }),
      request.delete(`${WORKER_URL_ENV_OFF}/admin/redeem_codes/1`, { headers }),
    ];
    const responses = await Promise.all(requests);
    for (const response of responses) {
      expect(response.status()).toBe(404);
    }
  });

  test('site password takes priority over otherwise public redemption APIs', async ({ request }) => {
    const settingsResponse = await request.get(`${WORKER_URL_SITE_PASSWORD}/open_api/settings`);
    expect(settingsResponse.ok()).toBe(true);
    expect(await settingsResponse.json()).toMatchObject({
      needAuth: true,
      enableRedeemCode: true,
    });

    const blockedAdminResponse = await request.post(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes/batch`,
      {
        // admin role token without the site password
        headers: { 'x-user-access-token': signTestToken(tokenPayload('admin')) },
        data: {
          count: 1,
          redeem_type: 'role',
          value: 'case-role',
          enabled: true,
          expires_at: futureExpiration(),
        },
      },
    );
    expect(blockedAdminResponse.status()).toBe(401);
    expect(await blockedAdminResponse.json()).toMatchObject({ code: 'AUTH_SITE_PASSWORD_INVALID' });

    const createResponse = await request.post(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes/batch`,
      {
        headers: ADMIN_HEADERS,
        data: {
          count: 1,
          redeem_type: 'role',
          value: 'case-role',
          enabled: true,
          expires_at: futureExpiration(),
        },
      },
    );
    expect(createResponse.ok()).toBe(true);
    const code = (await createResponse.json()).codes[0] as string;

    for (const path of ['query', 'result', 'redeem']) {
      const missingPassword = await request.post(
        `${WORKER_URL_SITE_PASSWORD}/redeem_api/${path}`,
        { data: { code } },
      );
      expect(missingPassword.status()).toBe(401);
      expect(await missingPassword.json()).toMatchObject({ code: 'AUTH_SITE_PASSWORD_INVALID' });
      const wrongPassword = await request.post(
        `${WORKER_URL_SITE_PASSWORD}/redeem_api/${path}`,
        { headers: { 'x-custom-auth': 'wrong' }, data: { code } },
      );
      expect(wrongPassword.status()).toBe(401);
      expect(await wrongPassword.json()).toMatchObject({ code: 'AUTH_SITE_PASSWORD_INVALID' });
    }
    const validPassword = await request.post(`${WORKER_URL_SITE_PASSWORD}/redeem_api/query`, {
      headers: SITE_HEADERS,
      data: { code },
    });
    expect(validPassword.ok()).toBe(true);
    expect(await validPassword.json()).toEqual({
      redeem_type: 'role', value: 'case-role', status: 'unused',
    });

    const listResponse = await request.get(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes?redeem_type=role`
      + `&limit=20&offset=0&query=${encodeURIComponent(code)}`,
      { headers: ADMIN_HEADERS },
    );
    const row = (await listResponse.json()).results[0];
    const deleteResponse = await request.delete(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes/${row.id}`,
      { headers: ADMIN_HEADERS },
    );
    expect(deleteResponse.ok()).toBe(true);
  });

  test('special-address redemption preserves the configured address regex', async ({ request }) => {
    const createResponse = await request.post(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes/batch`,
      {
        headers: ADMIN_HEADERS,
        data: {
          count: 1,
          redeem_type: 'address_prefix_once',
          value: '',
          enabled: true,
          expires_at: futureExpiration(),
        },
      },
    );
    expect(createResponse.ok()).toBe(true);
    const code = (await createResponse.json()).codes[0] as string;

    const redeemResponse = await request.post(
      `${WORKER_URL_SITE_PASSWORD}/redeem_api/redeem`,
      {
        headers: SITE_HEADERS,
        data: { code, name: 'blocked', domain: 'test.example.com' },
      },
    );
    expect(redeemResponse.status()).toBe(400);

    const queryResponse = await request.post(
      `${WORKER_URL_SITE_PASSWORD}/redeem_api/query`,
      { headers: SITE_HEADERS, data: { code } },
    );
    expect(queryResponse.ok()).toBe(true);

    const listResponse = await request.get(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes?redeem_type=address_prefix_once`
      + `&limit=20&offset=0&query=${encodeURIComponent(code)}`,
      { headers: ADMIN_HEADERS },
    );
    const row = (await listResponse.json()).results[0];
    const deleteResponse = await request.delete(
      `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes/${row.id}`,
      { headers: ADMIN_HEADERS },
    );
    expect(deleteResponse.ok()).toBe(true);
  });
});

test.describe('Redemption Admin authentication', () => {
  const baseUrl = `${WORKER_URL_SITE_PASSWORD}/admin/redeem_codes`;
  const listUrl = `${baseUrl}?redeem_type=address_prefix_once&limit=100&offset=0`;
  const codeData = () => ({
    count: 1,
    redeem_type: 'address_prefix_once',
    value: 'auth',
    enabled: true,
    expires_at: futureExpiration(),
  });
  const deniedCredentials: { name: string; headers: () => Record<string, string> }[] = [
    { name: 'site password alone', headers: () => ({}) },
    {
      name: 'mailbox JWT',
      headers: () => ({
        Authorization: `Bearer ${signTestToken({ address: 'mail@test.example.com', address_id: 1 })}`,
      }),
    },
    {
      name: 'user account JWT',
      headers: () => ({
        'x-user-token': signTestToken({ user_id: 1, exp: Math.floor(Date.now() / 1000) + 3600 }),
      }),
    },
    {
      name: 'non-Admin role token',
      headers: () => ({ 'x-user-access-token': signTestToken(tokenPayload('case-role')) }),
    },
    {
      name: 'forged Admin role token',
      headers: () => ({ 'x-user-access-token': signTestToken(tokenPayload('admin'), 'wrong-secret') }),
    },
    {
      name: 'expired Admin role token',
      headers: () => ({
        'x-user-access-token': signTestToken({ ...tokenPayload('admin'), exp: Math.floor(Date.now() / 1000) - 60 }),
      }),
    },
    {
      name: 'Admin role token without expiration',
      headers: () => ({ 'x-user-access-token': signTestToken({ user_id: 1, user_role: 'admin' }) }),
    },
    { name: 'malformed role token', headers: () => ({ 'x-user-access-token': 'not-a-jwt' }) },
  ];

  for (const credentials of deniedCredentials) {
    test(`rejects ${credentials.name} on all five endpoints without changing data`, async ({ request, playwright }) => {
      const original = codeData();
      const created = await request.post(`${baseUrl}/batch`, { headers: ADMIN_HEADERS, data: original });
      expect(created.ok()).toBe(true);
      const code = (await created.json()).codes[0] as string;
      const beforeResponse = await request.get(listUrl, { headers: ADMIN_HEADERS });
      expect(beforeResponse.ok()).toBe(true);
      const before = await beforeResponse.json();
      const row = before.results.find((item: { code: string }) => item.code === code);
      expect(row).toBeDefined();
      // newContext() inherits the project-level admin header; clear it so only the scenario's credentials apply.
      const denied = await playwright.request.newContext({ extraHTTPHeaders: {} });
      try {
        const headers = { ...SITE_HEADERS, ...credentials.headers() };
        const responses = await Promise.all([
          denied.get(listUrl, { headers }),
          denied.get(`${baseUrl}/export?redeem_type=address_prefix_once&limit=100`, { headers }),
          denied.post(`${baseUrl}/batch`, { headers, data: original }),
          denied.put(`${baseUrl}/${row.id}`, { headers, data: { ...original, value: 'changed' } }),
          denied.delete(`${baseUrl}/${row.id}`, { headers }),
        ]);
        for (const response of responses) {
          expect(response.status(), response.url()).toBe(401);
          expect(await response.json()).toMatchObject({
            code: credentials.name === 'expired Admin role token'
              ? 'AUTH_USER_ACCESS_TOKEN_EXPIRED' : 'AUTH_ADMIN_CREDENTIAL_INVALID',
          });
          expect(await response.text()).not.toContain(code);
        }
        const after = await request.get(listUrl, { headers: ADMIN_HEADERS });
        expect(after.ok()).toBe(true);
        expect(await after.json()).toEqual(before);
      } finally {
        await denied.dispose();
        const deleted = await request.delete(`${baseUrl}/${row.id}`, { headers: ADMIN_HEADERS });
        expect(deleted.ok()).toBe(true);
      }
    });
  }

  for (const tokenShape of ['role-only', 'with user id'] as const) {
    test(`accepts a valid Admin role token (${tokenShape}) for all five endpoints`, async ({ request }) => {
      const headers: Record<string, string> = {
        ...SITE_HEADERS,
        'x-user-access-token': signTestToken(tokenShape === 'with user id'
          ? tokenPayload('admin')
          : { user_role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }),
      };
      const original = codeData();
      const created = await request.post(`${baseUrl}/batch`, { headers, data: original });
      expect(created.ok()).toBe(true);
      const code = (await created.json()).codes[0] as string;
      const listResponse = await request.get(listUrl, { headers });
      expect(listResponse.ok()).toBe(true);
      const row = (await listResponse.json()).results.find((item: { code: string }) => item.code === code);
      expect(row).toBeDefined();
      let deleted = false;
      try {
        const exported = await request.get(`${baseUrl}/export?redeem_type=address_prefix_once&limit=100`, { headers });
        expect(exported.ok()).toBe(true);
        expect(exported.headers()['content-type']).toContain('text/csv');
        expect(await exported.text()).toContain(code);

        const updated = await request.put(`${baseUrl}/${row.id}`, { headers, data: { ...original, value: 'updated' } });
        expect(updated.ok()).toBe(true);
        const afterUpdate = await request.get(`${listUrl}&query=${encodeURIComponent(code)}`, { headers });
        expect(afterUpdate.ok()).toBe(true);
        expect((await afterUpdate.json()).results).toEqual([
          expect.objectContaining({ id: row.id, code, value: 'updated' }),
        ]);

        const deletion = await request.delete(`${baseUrl}/${row.id}`, { headers });
        expect(deletion.ok()).toBe(true);
        deleted = true;
        const afterDelete = await request.get(`${listUrl}&query=${encodeURIComponent(code)}`, { headers });
        expect(afterDelete.ok()).toBe(true);
        expect(await afterDelete.json()).toEqual({ results: [], count: 0 });
      } finally {
        if (!deleted) {
          const cleanup = await request.delete(`${baseUrl}/${row.id}`, { headers: ADMIN_HEADERS });
          expect(cleanup.ok()).toBe(true);
        }
      }
    });
  }
});
