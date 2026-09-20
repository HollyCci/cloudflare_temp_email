import { test as base } from '@playwright/test';
import { ADMIN_HEADERS } from './test-helpers.ts';

/**
 * Browser-project `test` whose `request` fixture authenticates as an admin.
 *
 * API projects get the same behaviour from `extraHTTPHeaders` in `playwright.config.ts`;
 * that option cannot be used for the browser project because it would also inject the
 * header into every page request and mask the frontend's own token handling.
 */
export const test = base.extend({
  request: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ extraHTTPHeaders: ADMIN_HEADERS });
    await use(context);
    await context.dispose();
  },
});

export { expect } from '@playwright/test';
