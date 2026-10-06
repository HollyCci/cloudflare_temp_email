import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '../../fixtures/test';
import { accountHeaders } from '../../fixtures/access-token';
import {
  FRONTEND_URL,
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  hashPassword,
  registerAndLoginUser,
} from '../../fixtures/test-helpers';

const userId = async (request: APIRequestContext, email: string): Promise<number> => {
  const res = await request.get(`${WORKER_URL}/admin/users`, { params: { limit: 10, offset: 0, query: email } });
  expect(res.ok()).toBe(true);
  return (await res.json()).results.find((user: { user_email: string }) => user.user_email === email).id;
};

test('an account the worker refuses is signed out, and the reason is shown', async ({ page, request }) => {
  const email = `refused-${Date.now()}@test.example.com`;
  const userJwt = await registerAndLoginUser(request, email, hashPassword('refused-pwd-123'));
  expect((await request.delete(`${WORKER_URL}/admin/users/${await userId(request, email)}`)).ok()).toBe(true);

  await page.addInitScript((token) => {
    localStorage.clear();
    localStorage.setItem('userJwt', token);
  }, userJwt);
  await page.goto(`${FRONTEND_URL}/admin`);

  await expect(page.getByText('登录已失效，请重新登录')).toBeVisible();
  await expect(page.getByText('需要管理员账号', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('userJwt'))).toBeNull();
});

test('a failed account load is reported rather than shown as an empty account, and can be retried', async ({ page, request }) => {
  const email = `unavailable-${Date.now()}@test.example.com`;
  const userJwt = await registerAndLoginUser(request, email, hashPassword('unavailable-pwd-123'));
  const mailbox = await createTestAddress(request, 'unavailable');
  try {
    const bound = await request.post(`${WORKER_URL}/user_api/bind_address`, {
      headers: { ...accountHeaders(userJwt), Authorization: `Bearer ${mailbox.jwt}` },
    });
    expect(bound.ok()).toBe(true);

    await page.addInitScript((token) => {
      localStorage.clear();
      localStorage.setItem('userJwt', token);
    }, userJwt);
    let unavailable = true;
    await page.route((url) => url.pathname === '/user_api/bind_address', async (route) => {
      if (!unavailable) return route.continue();
      unavailable = false;
      await route.fulfill({ status: 503, json: { code: 'OPERATION_FAILED', message: 'Mailbox list unavailable' } });
    });
    await page.goto(`${FRONTEND_URL}/`);

    await expect(page.getByRole('heading', { name: '账户加载失败' })).toBeVisible();
    await expect(page.getByText('Mailbox list unavailable').first()).toBeVisible();
    await expect(page.getByText('还没有邮箱')).toHaveCount(0);

    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.locator('aside').getByText(mailbox.address)).toBeVisible();
  } finally {
    await deleteAddress(request, mailbox.jwt);
    await request.delete(`${WORKER_URL}/admin/users/${await userId(request, email)}`);
  }
});
