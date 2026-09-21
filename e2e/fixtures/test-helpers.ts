import type { APIRequestContext } from '@playwright/test';
import { createHash } from 'crypto';
import WebSocket from 'ws';
import {
  E2E_JWT_SECRET_ENV_OFF,
  E2E_JWT_SECRET_SITE_PASSWORD,
  NO_ADMIN_TOKEN,
  adminHeaders,
} from './access-token.ts';

export * from './access-token.ts';

export const WORKER_URL = process.env.WORKER_URL!;
export const WORKER_URL_SUBDOMAIN = process.env.WORKER_URL_SUBDOMAIN || '';
export const WORKER_URL_ENV_OFF = process.env.WORKER_URL_ENV_OFF || '';
export const WORKER_GZIP_URL = process.env.WORKER_GZIP_URL || '';
export const WORKER_URL_SEND_MAIL_DOMAIN = process.env.WORKER_URL_SEND_MAIL_DOMAIN || '';
export const WORKER_URL_SITE_PASSWORD = process.env.WORKER_URL_SITE_PASSWORD || '';
export const FRONTEND_URL = process.env.FRONTEND_URL!;
export const FRONTEND_URL_ENV_OFF = process.env.FRONTEND_URL_ENV_OFF || '';
export const MAILPIT_API = process.env.MAILPIT_API!;
export const TEST_DOMAIN = 'test.example.com';

/** Site password of the `worker-site-password` variant (`PASSWORDS` in its wrangler.toml). */
export const SITE_HEADERS = { 'x-custom-auth': 'e2e-site-pass' };

/** Admin role token headers for the default worker (also gzip / subdomain / send-mail-domain variants). */
export const ADMIN_HEADERS = adminHeaders();
/** Admin role token headers for the `worker-env-off` variant. */
export const ADMIN_HEADERS_ENV_OFF = adminHeaders(E2E_JWT_SECRET_ENV_OFF);
/** Site password + admin role token headers for the `worker-site-password` variant. */
export const SITE_ADMIN_HEADERS = { ...SITE_HEADERS, ...adminHeaders(E2E_JWT_SECRET_SITE_PASSWORD) };

/**
 * Admin headers for whichever worker variant `workerUrl` points at.
 * The project-level admin header is signed for the default worker only.
 */
export function adminHeadersFor(workerUrl: string = WORKER_URL): Record<string, string> {
  if (WORKER_URL_ENV_OFF && workerUrl.startsWith(WORKER_URL_ENV_OFF)) return ADMIN_HEADERS_ENV_OFF;
  if (WORKER_URL_SITE_PASSWORD && workerUrl.startsWith(WORKER_URL_SITE_PASSWORD)) return SITE_ADMIN_HEADERS;
  return ADMIN_HEADERS;
}

/**
 * Account listed in `ADMIN_USER_EMAILS` of `fixtures/wrangler.toml.e2e`.
 * It may register even when registration is disabled and is granted the admin role on login.
 */
export const BOOTSTRAP_ADMIN_EMAIL = 'admin@test.example.com';
export const BOOTSTRAP_ADMIN_PASSWORD = 'e2e-bootstrap-admin-pwd';

/**
 * SHA-256 hash matching the frontend hashPassword utility.
 */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Register (idempotent) and log in a user account. Returns the user JWT
 * expected in `localStorage.userJwt` (raw string, not JSON encoded).
 * `password` must already be hashed with `hashPassword` if the UI will log in with it.
 */
export async function registerAndLoginUser(
  ctx: APIRequestContext,
  email: string,
  password: string,
  workerUrl: string = WORKER_URL,
): Promise<string> {
  const registerRes = await ctx.post(`${workerUrl}/user_api/register`, { data: { email, password } });
  if (!registerRes.ok() && registerRes.status() !== 400) {
    throw new Error(`Failed to register user: ${registerRes.status()} ${await registerRes.text()}`);
  }
  const loginRes = await ctx.post(`${workerUrl}/user_api/login`, { data: { email, password } });
  if (!loginRes.ok()) {
    throw new Error(`Failed to login user: ${loginRes.status()} ${await loginRes.text()}`);
  }
  const { jwt } = await loginRes.json();
  if (!jwt) throw new Error('Login response did not include a jwt');
  return jwt;
}

/**
 * Log in as the `ADMIN_USER_EMAILS` bootstrap account and return its user JWT.
 * Seeding it into `localStorage.userJwt` makes the frontend act as an admin:
 * `/user_api/settings` upserts the admin role and returns an admin access token.
 */
export async function loginAsBootstrapAdmin(
  ctx: APIRequestContext,
  workerUrl: string = WORKER_URL,
): Promise<string> {
  return registerAndLoginUser(ctx, BOOTSTRAP_ADMIN_EMAIL, hashPassword(BOOTSTRAP_ADMIN_PASSWORD), workerUrl);
}

/**
 * Create a new email address via the worker API.
 * Appends a timestamp suffix to avoid UNIQUE constraint collisions
 * with persistent D1 data from previous test runs.
 * Returns the JWT and full address string.
 */
export async function createTestAddress(
  ctx: APIRequestContext,
  name: string,
  domain: string = TEST_DOMAIN,
  workerUrl: string = WORKER_URL,
): Promise<{ jwt: string; address: string; address_id: number }> {
  const uniqueName = `${name}${Date.now()}`;
  const res = await ctx.post(`${workerUrl}/api/new_address`, {
    headers: NO_ADMIN_TOKEN,
    data: { name: uniqueName, domain },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create address: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return { jwt: body.jwt, address: body.address, address_id: body.address_id };
}

/**
 * Seed a test email by exercising the real worker email() handler
 * via the admin test endpoint.
 */
export async function seedTestMail(
  ctx: APIRequestContext,
  address: string,
  opts: { subject?: string; html?: string; text?: string; from?: string }
): Promise<void> {
  const from = opts.from || `sender@${TEST_DOMAIN}`;
  const subject = opts.subject || 'Test Email';
  const boundary = `----E2E${Date.now()}`;
  const htmlPart = opts.html || `<p>${opts.text || 'Hello from E2E'}</p>`;
  const textPart = opts.text || 'Hello from E2E';
  const messageId = `<e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@test>`;

  const raw = [
    `From: ${from}`,
    `To: ${address}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    textPart,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlPart,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await ctx.post(`${WORKER_URL}/__test/receive_mail`, {
    data: { from, to: address, raw },
  });
  if (!res.ok()) {
    throw new Error(`Failed to seed mail: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  if (!body.success) {
    throw new Error(`Mail was rejected: ${body.rejected || 'unknown reason'}`);
  }
}

/**
 * Send a mail via admin/send_mail, which saves to sendbox.
 */
export async function sendTestMail(
  ctx: APIRequestContext,
  fromAddress: string,
  opts: { to_mail: string; subject?: string; content?: string; is_html?: boolean }
): Promise<void> {
  const res = await ctx.post(`${WORKER_URL}/admin/send_mail`, {
    data: {
      from_name: '',
      from_mail: fromAddress,
      to_name: '',
      to_mail: opts.to_mail,
      subject: opts.subject || 'Test Sent Mail',
      content: opts.content || 'Sent mail body from E2E',
      is_html: opts.is_html ?? false,
    },
  });
  if (!res.ok()) {
    throw new Error(`Failed to send mail: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Delete all messages in Mailpit.
 */
export async function deleteAllMailpitMessages(ctx: APIRequestContext) {
  const res = await ctx.delete(`${MAILPIT_API}/v1/messages`);
  if (!res.ok()) {
    throw new Error(`Failed to delete Mailpit messages: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Derive the Mailpit WebSocket URL from the REST API URL.
 * MAILPIT_API is like "http://mailpit:8025/api" → ws://mailpit:8025/api/events
 */
function mailpitWsUrl(): string {
  return MAILPIT_API.replace(/^http/, 'ws') + '/events';
}

/**
 * Wait for a message matching `predicate` to arrive in Mailpit.
 *
 * Connects to Mailpit's WebSocket `/api/events` and listens for
 * `Type: "new"` events. When a matching message arrives, resolves
 * immediately — no polling, no arbitrary sleeps.
 *
 * Returns `{ ready, message }`:
 * - `ready` resolves when the WebSocket connection is open
 * - `message` resolves with the matched message summary
 *
 * Usage: await ready before triggering the send to avoid race conditions.
 */
export function onMailpitMessage(
  predicate: (msg: any) => boolean,
  { timeout = 10_000 }: { timeout?: number } = {}
): { ready: Promise<void>; message: Promise<any> } {
  let readyResolve: () => void;
  let readyReject: (err: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  const message = new Promise<any>((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(mailpitWsUrl());
    const timer = setTimeout(() => {
      ws.close();
      if (!settled) { settled = true; reject(new Error('Mailpit message not received within timeout')); }
    }, timeout);

    ws.on('open', () => readyResolve());

    ws.on('message', (data: WebSocket.Data) => {
      // Mailpit may batch multiple newline-separated events in one message.
      for (const line of data.toString().split('\n')) {
        if (settled) return;
        try {
          const event = JSON.parse(line);
          if (event.Type === 'new' && predicate(event.Data)) {
            clearTimeout(timer);
            settled = true;
            ws.close();
            resolve(event.Data);
            return;
          }
        } catch { /* ignore malformed events without dropping the remaining ones */ }
      }
    });

    ws.on('close', () => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(new Error('Mailpit WebSocket closed before matching message')); }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(timer);
      readyReject(err);
      if (!settled) { settled = true; reject(err); }
    });
  });

  return { ready, message };
}

/**
 * Request send mail access for an address.
 * Kept for backward compatibility and manual-request flows. When
 * DEFAULT_SEND_BALANCE > 0, send balance may already be auto-initialized
 * before this endpoint is called.
 */
export async function requestSendAccess(
  ctx: APIRequestContext,
  jwt: string
): Promise<void> {
  const res = await ctx.post(`${WORKER_URL}/api/request_send_mail_access`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok()) {
    throw new Error(`Failed to request send access: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Fetch the sender access row for an address from the admin API.
 */
export async function getAddressSender(
  ctx: APIRequestContext,
  address: string,
  workerUrl: string = WORKER_URL
): Promise<any> {
  const res = await ctx.get(
    `${workerUrl}/admin/address_sender?limit=1&offset=0&address=${encodeURIComponent(address)}`,
    { headers: adminHeadersFor(workerUrl) },
  );
  if (!res.ok()) {
    throw new Error(`Failed to get address sender: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  if (!Array.isArray(body.results) || body.results.length < 1) {
    throw new Error(`address_sender row not found for ${address}`);
  }
  return body.results[0];
}

/**
 * Update a sender access row through the admin API.
 */
export async function updateAddressSender(
  ctx: APIRequestContext,
  opts: {
    address: string;
    address_id: number;
    balance: number;
    enabled: boolean;
  },
  workerUrl: string = WORKER_URL
): Promise<void> {
  const res = await ctx.post(`${workerUrl}/admin/address_sender`, {
    headers: adminHeadersFor(workerUrl),
    data: opts,
  });
  if (!res.ok()) {
    throw new Error(`Failed to update address sender: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Delete a sender access row through the admin API by its id.
 */
export async function deleteAddressSender(
  ctx: APIRequestContext,
  id: number,
  workerUrl: string = WORKER_URL
): Promise<void> {
  const res = await ctx.delete(`${workerUrl}/admin/address_sender/${id}`, {
    headers: adminHeadersFor(workerUrl),
  });
  if (!res.ok()) {
    throw new Error(`Failed to delete address sender: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Delete a test address via its JWT.
 */
export async function deleteAddress(
  ctx: APIRequestContext,
  jwt: string
): Promise<void> {
  const res = await ctx.delete(`${WORKER_URL}/api/delete_address`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok()) {
    throw new Error(`Failed to delete address: ${res.status()} ${await res.text()}`);
  }
}
