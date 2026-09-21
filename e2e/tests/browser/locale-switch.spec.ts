import { expect, test } from '../../fixtures/test';
import { FRONTEND_URL } from '../../fixtures/test-helpers';

test.describe('Locale', () => {
  test('defaults to Chinese and ignores browser language', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('preferredLocale', 'en');
      Object.defineProperty(window.navigator, 'language', {
        configurable: true,
        get: () => 'en-US',
      });
      Object.defineProperty(window.navigator, 'languages', {
        configurable: true,
        get: () => ['en-US', 'en'],
      });
    });

    await page.goto(`${FRONTEND_URL}/`);

    await expect(page).toHaveURL(`${FRONTEND_URL}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  });

  test('redirects /en to the Chinese default route', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/en`);
    await expect(page).toHaveURL(`${FRONTEND_URL}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  });
});
