import { expect, test, type APIRequestContext } from '@playwright/test';

import { WORKER_URL, createTestAddress } from '../../fixtures/test-helpers';

// Drives the bot through its webhook; the replies are Chinese because e2e sets neither
// DEFAULT_LANG nor TG_ALLOW_USER_LANG.
async function command(request: APIRequestContext, userId: number, text: string): Promise<string> {
  const response = await request.post(`${WORKER_URL}/__test/telegram_command`, {
    data: { userId, text },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const replies: string[] = await response.json();
  expect(replies).toHaveLength(1);
  return replies[0];
}

async function bind(request: APIRequestContext, userId: number, jwt: string) {
  expect(await command(request, userId, `/bind ${jwt}`)).toMatch(/^绑定成功:\n/);
}

async function unbind(
  request: APIRequestContext, userId: number, address: string, outcome: 'unbound' | 'refused' = 'unbound',
) {
  const reply = await command(request, userId, `/unbind ${address}`);
  if (outcome === 'unbound') expect(reply).toBe(`解绑成功:\n地址: ${address}`);
  else expect(reply).toMatch(/^解绑失败: /);
}

async function addressList(request: APIRequestContext, userId: number) {
  const [heading, ...lines] = (await command(request, userId, '/address')).split('\n');
  expect(heading).toBe('地址列表:');
  return lines.filter(Boolean).map(line => line.replace(/^地址: /, ''));
}

async function expectPushOwner(request: APIRequestContext, address: string, userId: number | null) {
  const response = await request.get(`${WORKER_URL}/__test/telegram_binding`, {
    params: { address },
  });
  expect(response.ok(), await response.text()).toBe(true);
  expect(await response.json()).toBe(userId === null ? null : String(userId));
}

test('Telegram users can remove their own bindings after another user binds the mailbox', async ({ request }) => {
  const mailbox = await createTestAddress(request, 'tg-owner');
  const owner = Date.now();
  const other = owner + 1;
  try {
    await bind(request, owner, mailbox.jwt);
    await unbind(request, other, mailbox.address, 'refused');
    await expectPushOwner(request, mailbox.address, owner);
    await unbind(request, owner, mailbox.address);
    await expectPushOwner(request, mailbox.address, null);

    await bind(request, owner, mailbox.jwt);
    await bind(request, other, mailbox.jwt);
    await expectPushOwner(request, mailbox.address, other);
    await unbind(request, owner, mailbox.address);
    expect(await addressList(request, owner)).toEqual([]);
    expect(await addressList(request, other)).toEqual([mailbox.address]);
    await expectPushOwner(request, mailbox.address, other);
    await unbind(request, other, mailbox.address);
    expect(await addressList(request, other)).toEqual([]);
    await expectPushOwner(request, mailbox.address, null);

    await bind(request, owner, mailbox.jwt);
    await bind(request, other, mailbox.jwt);
    await bind(request, owner, mailbox.jwt);
    expect(await addressList(request, owner)).toEqual([mailbox.address]);
    await expectPushOwner(request, mailbox.address, owner);
    await unbind(request, other, mailbox.address);
    await expectPushOwner(request, mailbox.address, owner);
    await unbind(request, owner, mailbox.address);
    expect(await addressList(request, owner)).toEqual([]);
    await expectPushOwner(request, mailbox.address, null);
  } finally {
    await request.delete(`${WORKER_URL}/api/delete_address`, {
      headers: { Authorization: `Bearer ${mailbox.jwt}` },
    });
  }
});

test('stale Telegram credentials cannot unbind; internal mailbox cleanup still works', async ({ request }) => {
  const original = await createTestAddress(request, 'tg-stale');
  const owner = Date.now();
  await bind(request, owner, original.jwt);
  const deletion = await request.delete(`${WORKER_URL}/admin/delete_address/${original.address_id}`);
  expect(deletion.ok()).toBe(true);
  const [name, domain] = original.address.split('@');
  const creation = await request.post(`${WORKER_URL}/admin/new_address`, {
    data: { name, domain, enablePrefix: false },
  });
  expect(creation.ok()).toBe(true);
  const recreated = await creation.json();
  try {
    expect(recreated.address_id).not.toBe(original.address_id);
    await unbind(request, owner, recreated.address, 'refused');
    await expectPushOwner(request, recreated.address, owner);
    const response = await request.delete(`${WORKER_URL}/api/delete_address`, {
      headers: { Authorization: `Bearer ${recreated.jwt}` },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await expectPushOwner(request, recreated.address, null);
    expect(await addressList(request, owner)).toEqual([]);
  } finally {
    await request.delete(`${WORKER_URL}/admin/delete_address/${recreated.address_id}`);
  }
});

test('Telegram unbind accepts a current credential after a stale credential for the same address', async ({ request }) => {
  const original = await createTestAddress(request, 'tg-recreated');
  const unrelated = await createTestAddress(request, 'tg-retained');
  const owner = Date.now();
  await bind(request, owner, original.jwt);
  await bind(request, owner, unrelated.jwt);
  const deletion = await request.delete(`${WORKER_URL}/admin/delete_address/${original.address_id}`);
  expect(deletion.ok()).toBe(true);
  const [name, domain] = original.address.split('@');
  const creation = await request.post(`${WORKER_URL}/admin/new_address`, {
    data: { name, domain, enablePrefix: false },
  });
  expect(creation.ok()).toBe(true);
  const recreated = await creation.json();
  try {
    expect(recreated.address_id).not.toBe(original.address_id);
    await bind(request, owner, recreated.jwt);
    await unbind(request, owner, recreated.address);
    await expectPushOwner(request, recreated.address, null);
    expect(await addressList(request, owner)).toEqual([unrelated.address]);
    await expectPushOwner(request, unrelated.address, owner);
  } finally {
    for (const mailbox of [recreated, unrelated]) {
      await request.delete(`${WORKER_URL}/api/delete_address`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
      });
    }
  }
});
