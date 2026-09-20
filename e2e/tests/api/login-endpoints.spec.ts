import { test, expect } from '@playwright/test';
import { ADMIN_HEADERS, WORKER_URL, createTestAddress, deleteAddress, hashPassword, signAccessToken } from '../../fixtures/test-helpers';

test.describe('Turnstile Login Endpoints (ENABLE_GLOBAL_TURNSTILE_CHECK disabled)', () => {

  test('settings returns enableGlobalTurnstileCheck as false', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/open_api/settings`);
    expect(res.ok()).toBe(true);
    const settings = await res.json();
    expect(settings.enableGlobalTurnstileCheck).toBe(false);
  });

  test.describe('/open_api/site_login', () => {
    test('returns 401 when no PASSWORDS configured', async ({ request }) => {
      const res = await request.post(`${WORKER_URL}/open_api/site_login`, {
        data: {
          password: hashPassword('any-pass'),
          cf_token: ''
        }
      });
      expect(res.status()).toBe(401);
      expect(await res.json()).toMatchObject({ code: 'AUTH_SITE_PASSWORD_INVALID', message: expect.any(String) });
    });
  });

  test.describe('role-based admin access', () => {
    test('admin password login endpoint no longer exists', async ({ request }) => {
      const res = await request.post(`${WORKER_URL}/open_api/admin_login`, {
        data: { password: hashPassword('any-pass'), cf_token: '' },
      });
      expect(res.status()).toBe(404);
    });

    test('admin role token succeeds', async ({ request }) => {
      const res = await request.get(`${WORKER_URL}/admin/db_version`, { headers: ADMIN_HEADERS });
      expect(res.ok()).toBe(true);
    });

    test('missing role token returns 401', async ({ playwright }) => {
      // newContext() inherits the project-level admin header; clear it for an anonymous call.
      const anonymous = await playwright.request.newContext({ extraHTTPHeaders: {} });
      try {
        const res = await anonymous.get(`${WORKER_URL}/admin/db_version`);
        expect(res.status()).toBe(401);
        expect(await res.json()).toMatchObject({ code: 'AUTH_ADMIN_CREDENTIAL_INVALID', message: expect.any(String) });
      } finally {
        await anonymous.dispose();
      }
    });

    test('non-admin role token returns 401', async ({ request }) => {
      const res = await request.get(`${WORKER_URL}/admin/db_version`, {
        headers: {
          'x-user-access-token': signAccessToken({ user_role: 'case-role', exp: Math.floor(Date.now() / 1000) + 3600 }),
        },
      });
      expect(res.status()).toBe(401);
      expect(await res.json()).toMatchObject({ code: 'AUTH_ADMIN_CREDENTIAL_INVALID', message: expect.any(String) });
    });
  });

  test.describe('/open_api/credential_login', () => {
    test('valid JWT credential succeeds', async ({ request }) => {
      const { jwt, address } = await createTestAddress(request, 'cred-login');
      try {
        const res = await request.post(`${WORKER_URL}/open_api/credential_login`, {
          data: {
            credential: jwt,
            cf_token: ''
          }
        });
        expect(res.ok()).toBe(true);
        const body = await res.json();
        expect(body.success).toBe(true);
      } finally {
        await deleteAddress(request, jwt);
      }
    });

    test('invalid JWT returns 401', async ({ request }) => {
      const res = await request.post(`${WORKER_URL}/open_api/credential_login`, {
        data: {
          credential: 'invalid.jwt.token',
          cf_token: ''
        }
      });
      expect(res.status()).toBe(401);
    });

    test('empty credential returns 401', async ({ request }) => {
      const res = await request.post(`${WORKER_URL}/open_api/credential_login`, {
        data: {
          credential: '',
          cf_token: ''
        }
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('/api/address_login with cf_token', () => {
    test('address login with empty cf_token works when turnstile disabled', async ({ request }) => {
      const { jwt, address } = await createTestAddress(request, 'addr-cf');
      try {
        // Set a password
        await request.post(`${WORKER_URL}/api/address_change_password`, {
          headers: { Authorization: `Bearer ${jwt}` },
          data: { new_password: hashPassword('addr-pass-123') },
        });

        // Login with cf_token field present but empty
        const loginRes = await request.post(`${WORKER_URL}/api/address_login`, {
          data: {
            email: address,
            password: hashPassword('addr-pass-123'),
            cf_token: ''
          },
        });
        expect(loginRes.ok()).toBe(true);
        const body = await loginRes.json();
        expect(body.jwt).toBeTruthy();
      } finally {
        await deleteAddress(request, jwt);
      }
    });
  });
});
