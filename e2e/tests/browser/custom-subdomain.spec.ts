import { expect, test } from '../../fixtures/test';
import {
  FRONTEND_URL,
  TEST_DOMAIN,
  WORKER_URL,
  loginAsBootstrapAdmin,
} from '../../fixtures/test-helpers';

test('create an address with a custom subdomain from the admin UI', async ({ page, request }) => {
  // Use the admin page — it has CreateAddressForm without Turnstile.
  const adminJwt = await loginAsBootstrapAdmin(request);
  await page.addInitScript((token) => {
    localStorage.clear();
    localStorage.setItem('userJwt', token);
  }, adminJwt);
  await page.goto(`${FRONTEND_URL}/admin`);

  // Wait for the admin console to load (default tab is "create").
  const nameField = page.locator('[name="addressName"]');
  await expect(nameField).toBeVisible({ timeout: 10_000 });

  const name = `subui${Date.now()}`;
  await nameField.fill(name);

  // Subdomain radio group — e2e wrangler.toml enables RANDOM_SUBDOMAIN_DOMAINS for TEST_DOMAIN.
  const noneRadio = page.getByRole('radio', { name: '不使用' });
  const randomRadio = page.getByRole('radio', { name: '随机' });
  const customRadio = page.getByRole('radio', { name: '自定义' });

  await expect(noneRadio).toBeChecked();

  await randomRadio.click();
  await expect(noneRadio).not.toBeChecked();
  await expect(randomRadio).toBeChecked();
  await expect(customRadio).not.toBeChecked();

  await customRadio.click();
  await expect(randomRadio).not.toBeChecked();
  await expect(customRadio).toBeChecked();

  await randomRadio.click();
  await expect(randomRadio).toBeChecked();
  await expect(customRadio).not.toBeChecked();

  await customRadio.click();
  await page.locator('[name="subdomain"]').fill('team');

  // Intercept the create response to capture the JWT for cleanup.
  const createResponse = page.waitForResponse(
    (r) => r.url().includes('/admin/new_address') && r.request().method() === 'POST',
  );

  // ActionButton with confirm: first click opens popover, second confirms.
  await page.getByRole('button', { name: '创建' }).first().click();
  await page.getByRole('button', { name: '创建' }).last().click();

  const res = await createResponse;
  expect(res.ok()).toBe(true);
  const body = await res.json();
  const jwt: string = body.jwt;
  expect(jwt).toBeTruthy();

  const domain = `team.${TEST_DOMAIN}`;
  // The credential modal should show the created address.
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('dialog').getByText(domain)).toBeVisible();

  // Cleanup.
  const del = await request.delete(`${WORKER_URL}/api/address`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  expect(del.ok()).toBe(true);
});
