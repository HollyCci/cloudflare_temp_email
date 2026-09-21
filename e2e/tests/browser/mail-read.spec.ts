import { expect, test } from '../../fixtures/test';
import {
  FRONTEND_URL,
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  seedTestMail,
} from '../../fixtures/test-helpers';

test('opening a mail automatically marks it as read', async ({ page, request }) => {
  let jwt: string | undefined;
  try {
    const mailbox = await createTestAddress(request, 'mail-read-browser');
    jwt = mailbox.jwt;
    const subject = `Unread browser mail ${Date.now()}`;
    await seedTestMail(request, mailbox.address, { subject });

    await page.goto(`${FRONTEND_URL}/?jwt=${jwt}`);
    await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 });

    // Verify the mail is unread via API.
    const list = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const mail = (await list.json()).results.find((item: any) => item.raw.includes(subject));
    expect(mail.is_unread).toBe(1);

    // Click to open — React frontend auto-marks as read on selection.
    const readResponse = page.waitForResponse(
      (response) =>
        /\/api\/mails\/\d+\/read$/.test(new URL(response.url()).pathname) &&
        response.request().method() === 'PATCH',
    );
    await page.getByText(subject).first().click();
    await expect(page.getByRole('heading', { name: subject }).first()).toBeVisible({ timeout: 5_000 });

    expect((await readResponse).ok()).toBe(true);

    // Verify the mail is now read via API.
    const updatedList = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const updatedMail = (await updatedList.json()).results.find((item: any) => item.id === mail.id);
    expect(updatedMail.is_unread).toBe(0);
  } finally {
    if (jwt) await deleteAddress(request, jwt);
  }
});
