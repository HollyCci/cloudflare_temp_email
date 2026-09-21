import { createHmac } from 'node:crypto';

/**
 * JWT secrets of the E2E worker variants.
 * Keep in sync with `JWT_SECRET` in `fixtures/wrangler.toml.e2e*`.
 */
export const E2E_JWT_SECRET = 'e2e-test-secret-key';
export const E2E_JWT_SECRET_ENV_OFF = 'e2e-test-secret-key-env-off';
export const E2E_JWT_SECRET_SITE_PASSWORD = 'e2e-site-password-secret';

/** Matches `ADMIN_USER_ROLE` (default `admin`) in the E2E worker configs. */
export const E2E_ADMIN_ROLE = 'admin';

const base64url = (value: string) => Buffer.from(value).toString('base64url');

/**
 * Sign an HS256 JWT the same way the worker does (hono/utils/jwt).
 */
export function signAccessToken(payload: Record<string, unknown>, secret: string = E2E_JWT_SECRET): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * User id carried by the synthetic admin token. The worker only ever issues an access token
 * from `/user_api/settings`, which always includes `user_id`, so a token without one is
 * rejected. This token belongs to no account, and 0 matches no row (ids start at 1), so if it
 * ever reached a route that binds the role to the caller the binding check would refuse it.
 */
const E2E_ADMIN_USER_ID = 0;

/**
 * `x-user-access-token` value carrying the admin role.
 * Admin APIs are role-based: this token is what grants `/admin/*` access in tests.
 */
export function adminAccessToken(secret: string = E2E_JWT_SECRET, expiresInSeconds = 24 * 3600): string {
  return signAccessToken({
    user_id: E2E_ADMIN_USER_ID,
    user_role: E2E_ADMIN_ROLE,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }, secret);
}

/**
 * Request headers that authenticate as an admin against the worker signed with `secret`.
 */
export function adminHeaders(secret: string = E2E_JWT_SECRET): Record<string, string> {
  return { 'x-user-access-token': adminAccessToken(secret) };
}

/**
 * Headers for acting as an account.
 *
 * The empty `x-user-access-token` clears the project-level admin role token. That token is
 * signed for no particular account, and the worker refuses a role token it cannot bind to the
 * caller rather than silently dropping the role, so it must not ride along on account calls.
 */
export function accountHeaders(userJwt: string): Record<string, string> {
  return { 'x-user-token': userJwt, 'x-user-access-token': '' };
}
