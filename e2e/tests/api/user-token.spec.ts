import { expect, test, type APIRequestContext } from '@playwright/test';
import { NO_ADMIN_TOKEN, accountHeaders, signAccessToken } from '../../fixtures/access-token';
import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  hashPassword,
  registerAndLoginUser,
} from '../../fixtures/test-helpers';

const INVALID = { code: 'AUTH_USER_TOKEN_INVALID', message: 'Your sign-in is no longer valid, please sign in again' };
const now = () => Math.floor(Date.now() / 1000);

const userId = async (request: APIRequestContext, email: string): Promise<number> => {
  const res = await request.get(`${WORKER_URL}/admin/users`, { params: { limit: 10, offset: 0, query: email } });
  expect(res.ok()).toBe(true);
  return (await res.json()).results.find((user: { user_email: string }) => user.user_email === email).id;
};

const settingsAs = (request: APIRequestContext, userJwt?: string) => request.get(`${WORKER_URL}/user_api/settings`, {
  headers: { ...NO_ADMIN_TOKEN, 'x-lang': 'en', ...(userJwt === undefined ? {} : { 'x-user-token': userJwt }) },
});

test('an unusable account token gets one answer wherever an account is read', async ({ request }) => {
  const email = `token-${Date.now()}@test.example.com`;
  const jwt = await registerAndLoginUser(request, email, hashPassword('token-pwd-123'));
  const id = await userId(request, email);
  try {
    expect((await settingsAs(request, jwt)).ok()).toBe(true);

    const claims = { user_id: id, user_email: email };
    const unusable = {
      expired: signAccessToken({ ...claims, exp: now() - 60 }),
      forged: signAccessToken({ ...claims, exp: now() + 3600 }, 'wrong-secret'),
      'without expiry': signAccessToken(claims),
      'without email': signAccessToken({ user_id: id, exp: now() + 3600 }),
      'naming another email': signAccessToken({ user_id: id, user_email: `other-${email}`, exp: now() + 3600 }),
      'not a JWT': 'not-a-jwt',
    };
    for (const [name, token] of Object.entries(unusable)) {
      const settings = await settingsAs(request, token);
      expect(settings.status(), name).toBe(401);
      expect(await settings.json(), name).toEqual(INVALID);
      // creating an address reads the account when a token is presented
      const created = await request.post(`${WORKER_URL}/api/new_address`, {
        headers: { ...NO_ADMIN_TOKEN, 'x-lang': 'en', 'x-user-token': token },
        data: { name: `token${Date.now()}` },
      });
      expect(created.status(), name).toBe(401);
      expect(await created.json(), name).toEqual(INVALID);
    }

    const missing = await settingsAs(request);
    expect(missing.status()).toBe(401);
    expect(await missing.json()).toEqual(INVALID);
  } finally {
    await request.delete(`${WORKER_URL}/admin/users/${id}`);
  }
});

test('the token of a deleted account is refused like any other unusable token', async ({ request }) => {
  const email = `deleted-${Date.now()}@test.example.com`;
  const jwt = await registerAndLoginUser(request, email, hashPassword('deleted-pwd-123'));
  expect((await request.delete(`${WORKER_URL}/admin/users/${await userId(request, email)}`)).ok()).toBe(true);

  const settings = await settingsAs(request, jwt);
  expect(settings.status()).toBe(401);
  expect(await settings.json()).toEqual(INVALID);
});

test('an account that takes a deleted account\'s id inherits nothing from it', async ({ request }) => {
  const password = hashPassword('reuse-pwd-123');
  const first = `reuse-a-${Date.now()}@test.example.com`;
  const firstJwt = await registerAndLoginUser(request, first, password);
  const id = await userId(request, first);
  const mailbox = await createTestAddress(request, 'reuse');
  let secondId: number | undefined;
  try {
    expect((await request.post(`${WORKER_URL}/admin/user_roles`, { data: { user_id: id, role_text: 'case-role' } })).ok()).toBe(true);
    const bound = await request.post(`${WORKER_URL}/user_api/bind_address`, {
      headers: { ...accountHeaders(firstJwt), Authorization: `Bearer ${mailbox.jwt}` },
    });
    expect(bound.ok()).toBe(true);
    expect((await request.delete(`${WORKER_URL}/admin/users/${id}`)).ok()).toBe(true);

    // SQLite gives the highest deleted rowid to the next insert; e2e runs one test at a time.
    const second = `reuse-b-${Date.now()}@test.example.com`;
    const secondJwt = await registerAndLoginUser(request, second, password);
    secondId = await userId(request, second);
    expect(secondId).toBe(id);

    const stale = await settingsAs(request, firstJwt);
    expect(stale.status()).toBe(401);
    expect(await stale.json()).toEqual(INVALID);

    const settings = await settingsAs(request, secondJwt);
    expect(settings.ok()).toBe(true);
    expect((await settings.json()).user_role).toBeNull();
    const addresses = await request.get(`${WORKER_URL}/user_api/bind_address`, {
      headers: accountHeaders(secondJwt),
      params: { limit: 50, offset: 0 },
    });
    expect(addresses.ok()).toBe(true);
    expect((await addresses.json()).results).toEqual([]);
  } finally {
    await deleteAddress(request, mailbox.jwt);
    if (secondId !== undefined) await request.delete(`${WORKER_URL}/admin/users/${secondId}`);
  }
});
