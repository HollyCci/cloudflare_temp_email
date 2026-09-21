import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '../../fixtures/test';
import {
  FRONTEND_URL,
  WORKER_URL,
  hashPassword,
  loginAsBootstrapAdmin,
} from '../../fixtures/test-helpers';

/**
 * The admin console is role-gated: there is no admin password.
 * - guests are asked to sign in
 * - signed-in accounts without the admin role are refused
 * - accounts listed in ADMIN_USER_EMAILS are granted the role on login and manage users/roles
 *
 * The UI renders in the default locale (zh); assertions use those strings.
 */

const openAdminAs = async (page: Page, userJwt: string) => {
  await page.addInitScript((token) => {
    localStorage.clear();
    if (token) localStorage.setItem('userJwt', token);
  }, userJwt);
  await page.goto(`${FRONTEND_URL}/admin`);
};

const adminNavEntry = (page: Page) => page.locator('aside').getByText('管理', { exact: true });

const memberRole = async (request: APIRequestContext, email: string) => {
  const res = await request.get(`${WORKER_URL}/admin/users`, { params: { limit: 10, offset: 0, query: email } });
  expect(res.ok()).toBe(true);
  return (await res.json()).results[0].role_text as string | null;
};

test('guest is asked for an admin account and sees no admin entry', async ({ page }) => {
  await openAdminAs(page, '');
  await expect(page.getByText('需要管理员账号', { exact: true })).toBeVisible();
  await expect(adminNavEntry(page)).toHaveCount(0);
});

test.describe('signed-in accounts', () => {
  const password = hashPassword('member-pwd-123');
  let memberEmail: string;
  let memberId: number;

  test.beforeEach(async ({ request }) => {
    memberEmail = `member-${Date.now()}@test.example.com`;
    const created = await request.post(`${WORKER_URL}/admin/users`, { data: { email: memberEmail, password } });
    expect(created.ok()).toBe(true);
    const list = await request.get(`${WORKER_URL}/admin/users`, { params: { limit: 10, offset: 0, query: memberEmail } });
    expect(list.ok()).toBe(true);
    memberId = (await list.json()).results.find((user: { user_email: string }) => user.user_email === memberEmail).id;
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`${WORKER_URL}/admin/users/${memberId}`);
  });

  test('account without the admin role is refused', async ({ page, request }) => {
    const login = await request.post(`${WORKER_URL}/user_api/login`, { data: { email: memberEmail, password } });
    expect(login.ok()).toBe(true);
    await openAdminAs(page, (await login.json()).jwt);

    await expect(page.getByText('无权访问', { exact: true })).toBeVisible();
    await expect(adminNavEntry(page)).toHaveCount(0);
  });

  test('bootstrap admin gets the role on login and manages user roles', async ({ page, request }) => {
    await openAdminAs(page, await loginAsBootstrapAdmin(request));

    await expect(adminNavEntry(page)).toHaveCount(1);
    await page.getByRole('tab', { name: '用户' }).click();
    await expect(page.getByText(memberEmail)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('当前账户', { exact: true })).toBeVisible();

    // Assign a role, then clear it; verify through the admin API.
    const memberRow = page.getByRole('row').filter({ hasText: memberEmail });
    await memberRow.getByRole('button', { name: '角色' }).click();
    await page.getByRole('option', { name: 'case-role' }).click();
    await expect.poll(() => memberRole(request, memberEmail)).toBe('case-role');

    await memberRow.getByRole('button', { name: '角色' }).click();
    await page.getByRole('option', { name: '无角色' }).click();
    await expect.poll(() => memberRole(request, memberEmail)).toBeNull();

    // An admin cannot delete their own account from the list.
    const selfRow = page.getByRole('row').filter({ hasText: '当前账户' });
    await expect(selfRow.getByRole('button', { name: '删除' })).toBeDisabled();
  });
});
