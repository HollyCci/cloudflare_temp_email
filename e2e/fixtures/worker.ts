import { AsyncLocalStorage } from 'node:async_hooks';
import { Hono } from 'hono';
import worker from '../../worker/src/worker';
import { CONSTANTS } from '../../worker/src/constants';
import mailApi from './mail-api';

// The bot answers through the Telegram Bot API (wrangler bundles telegraf's node-fetch as a shim
// over globalThis.fetch). While /__test/telegram_command drives the bot, answer those calls here
// and keep the message texts; any other method fails the call so the test sees it.
const telegramReplies = new AsyncLocalStorage<string[]>();
const passthroughFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const replies = telegramReplies.getStore();
  const url = new URL(input instanceof Request ? input.url : input);
  if (!replies || url.hostname !== 'api.telegram.org') return passthroughFetch(input, init);
  const method = url.pathname.split('/').pop();
  if (method === 'getMe') {
    return Response.json({ ok: true, result: { id: 1, is_bot: true, first_name: 'e2e', username: 'e2e_bot' } });
  }
  if (method !== 'sendMessage') {
    return Response.json({ ok: false, error_code: 400, description: `e2e does not answer ${method}` });
  }
  const { chat_id, text } = JSON.parse(String(init?.body));
  replies.push(text);
  return Response.json({
    ok: true,
    result: { message_id: replies.length, date: 0, chat: { id: chat_id, type: 'private' }, text },
  });
};

const testApi = new Hono<HonoCustomType>();
testApi.post('/seed_mail', c => mailApi.seedMail(c.req.raw, c.env));
testApi.post('/receive_mail', c => mailApi.receiveMail(c.req.raw, c.env, c.executionCtx as ExecutionContext));
testApi.get('/telegram_binding', async c => {
  const address = c.req.query('address');
  if (!address) return c.text('address is required', 400);
  return c.json(await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${address}`));
});
// Sends a private-chat command to the bot webhook, as Telegram would, and returns the bot's replies.
testApi.post('/telegram_command', async c => {
  const { userId, text } = await c.req.json<{ userId: number; text: string }>();
  const message = {
    message_id: 1,
    date: Math.floor(Date.now() / 1000),
    chat: { id: userId, type: 'private' },
    from: { id: userId, is_bot: false, first_name: 'e2e' },
    text,
    entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }],
  };
  const webhook = new Request(new URL('/telegram/webhook', c.req.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ update_id: 1, message }),
  });
  const replies: string[] = [];
  const response = await telegramReplies.run(replies, () => worker.fetch(webhook, c.env, c.executionCtx));
  if (!response.ok) return c.text(`webhook returned ${response.status}: ${await response.text()}`, 502);
  return c.json(replies);
});

const app = new Hono<HonoCustomType>();
app.route('/__test', testApi);
app.all('*', c => worker.fetch(c.req.raw, c.env, c.executionCtx));

export default { ...worker, fetch: app.fetch };
