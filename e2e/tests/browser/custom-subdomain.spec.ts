import { expect, test } from '../../fixtures/test';
import {
  FRONTEND_URL,
  TEST_DOMAIN,
  deleteAddress,
  loginAsBootstrapAdmin,
} from '../../fixtures/test-helpers';

// The admin console's create form has no Turnstile, so it can be driven end to end.
test('create an address with a custom subdomain from the admin UI', async ({ page, request }) => {
  const adminJwt = await loginAsBootstrapAdmin(request);
  await page.addInitScript((token) => {
    localStorage.clear();
    localStorage.setItem('userJwt', token);
  }, adminJwt);
  await page.goto(`${FRONTEND_URL}/admin`);

  const name = `subui${Date.now()}`;
  await page.getByRole('textbox', { name: '用户名' }).fill(name);

  // RANDOM_SUBDOMAIN_DOMAINS in the e2e wrangler.toml covers TEST_DOMAIN.
  // HeroUI draws over the native radio input, so choose an option through its label.
  const subdomain = page.getByRole('radiogroup', { name: '子域名' });
  const radio = (label: string) => subdomain.getByRole('radio', { name: label });
  const choose = (label: string) => subdomain.getByText(label, { exact: true }).click();

  await expect(radio('不使用')).toBeChecked();

  await choose('随机');
  await expect(radio('不使用')).not.toBeChecked();
  await expect(radio('随机')).toBeChecked();
  await expect(radio('自定义')).not.toBeChecked();

  await choose('自定义');
  await expect(radio('随机')).not.toBeChecked();
  await expect(radio('自定义')).toBeChecked();

  await choose('随机');
  await expect(radio('随机')).toBeChecked();
  await expect(radio('自定义')).not.toBeChecked();

  await choose('自定义');
  await page.locator('[name="subdomain"]').fill('team');

  const created = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/admin/new_address' && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '创建', exact: true }).click();
  const res = await created;
  expect(res.ok()).toBe(true);
  const { address, jwt } = await res.json();

  try {
    expect(address).toMatch(new RegExp(`${name}@team\\.${TEST_DOMAIN.replace(/\./g, '\\.')}$`));
    await expect(page.getByRole('dialog').getByText(address, { exact: true })).toBeVisible();
  } finally {
    await deleteAddress(request, jwt);
  }
});
