import { expect, test } from '../../fixtures/test';
import {
  FRONTEND_URL,
  createTestAddress,
  seedTestMail,
  deleteAddress,
} from '../../fixtures/test-helpers';

test.describe('Inbox Browser Flow', () => {
  test('login via JWT, view inbox, open email', async ({ page, request }) => {
    let jwt: string | undefined;

    try {
      const created = await createTestAddress(request, 'inbox-browser');
      jwt = created.jwt;
      const address = created.address;

      const subject = `Browser Test ${Date.now()}`;
      await seedTestMail(request, address, {
        subject,
        html: '<h1>Welcome</h1><p>This is a <b>browser test</b> email.</p>',
      });

      await page.goto(`${FRONTEND_URL}/?jwt=${jwt}`);

      await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 });
      await page.getByText(subject).first().click();
      await expect(page.getByRole('heading', { name: subject }).first()).toBeVisible({ timeout: 5_000 });
    } finally {
      if (jwt) await deleteAddress(request, jwt);
    }
  });
});
