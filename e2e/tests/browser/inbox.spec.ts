import { expect, test } from '../../fixtures/test';
import {
  ADMIN_HEADERS,
  FRONTEND_URL,
  createTestAddress,
  seedTestMail,
  deleteAddress,
} from '../../fixtures/test-helpers';
import { request as apiRequest } from '@playwright/test';

test.describe('Inbox Browser Flow', () => {
  test('login via JWT, view inbox, open email', async ({ page }) => {
    // Create API context for setup
    const api = await apiRequest.newContext({ extraHTTPHeaders: ADMIN_HEADERS });
    let jwt: string | undefined;

    try {
      const created = await createTestAddress(api, 'inbox-browser');
      jwt = created.jwt;
      const address = created.address;

      // Seed an email
      const subject = `Browser Test ${Date.now()}`;
      await seedTestMail(api, address, {
        subject,
        html: '<h1>Welcome</h1><p>This is a <b>browser test</b> email.</p>',
      });

      // Login via JWT query param with /en/ path to force English locale
      await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);

      await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 });
      await page.getByText(subject).first().click();
      await expect(page.getByRole('heading', { name: subject }).first()).toBeVisible({ timeout: 5_000 });
    } finally {
      try {
        if (jwt) await deleteAddress(api, jwt);
      } finally {
        await api.dispose();
      }
    }
  });
});
