import { expect, test } from '../../fixtures/test';
import { accountHeaders } from '../../fixtures/access-token';
import {
  FRONTEND_URL,
  WORKER_URL,
  deleteAddress,
  hashPassword,
  registerAndLoginUser,
} from '../../fixtures/test-helpers';

// The e2e worker enables ENABLE_USER_CREATE_EMAIL and configures no Turnstile.
test('a mailbox created from the account page is bound to that account', async ({ page, request }) => {
  const email = `owner-${Date.now()}@test.example.com`;
  const userJwt = await registerAndLoginUser(request, email, hashPassword('owner-pwd-123'));
  let mailboxJwt: string | undefined;

  try {
    await page.addInitScript((token) => {
      localStorage.clear();
      localStorage.setItem('userJwt', token);
    }, userJwt);
    await page.goto(`${FRONTEND_URL}/user`);

    await page.getByRole('textbox', { name: '用户名' }).fill(`owned${Date.now()}`);
    const created = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/new_address' && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '创建', exact: true }).click();
    const res = await created;
    expect(res.ok()).toBe(true);
    const { address, jwt } = await res.json();
    mailboxJwt = jwt;

    await expect.poll(async () => {
      const bound = await request.get(`${WORKER_URL}/user_api/bind_address`, {
        headers: accountHeaders(userJwt),
        params: { limit: 50, offset: 0 },
      });
      expect(bound.ok()).toBe(true);
      return (await bound.json()).results.map((row: { name: string }) => row.name);
    }).toEqual([address]);

    await page.getByRole('dialog').getByRole('button', { name: '关闭' }).click();
    await expect(page.getByRole('grid', { name: '已绑定地址' }).getByRole('row').filter({ hasText: address })).toBeVisible();
  } finally {
    if (mailboxJwt) await deleteAddress(request, mailboxJwt);
    const users = await request.get(`${WORKER_URL}/admin/users`, { params: { limit: 10, offset: 0, query: email } });
    const user = (await users.json()).results.find((row: { user_email: string }) => row.user_email === email);
    if (user) await request.delete(`${WORKER_URL}/admin/users/${user.id}`);
  }
});
