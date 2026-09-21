import { Context } from 'hono';
import { Jwt } from 'hono/utils/jwt';

import i18n from './i18n';
import { ErrorCode } from './error_codes';
import { getAdminRole, getEnvStringList } from './utils';

export type AccessTokenPayload = {
    user_id: number
    user_role: string
}

/**
 * The result of reading a credential header.
 *
 * `absent` is the only non-`ok` state a route may choose to accept: it means the caller made
 * no claim at all. Every other state means a claim was made and cannot be honoured, and is
 * never downgraded to `absent` — a broken credential must not quietly become anonymity.
 */
export type Credential<T> =
    | { state: 'absent' }
    | { state: 'invalid' }
    | { state: 'no_expiry' }
    | { state: 'expired' }
    | { state: 'ok', payload: T }

const readCredential = async <T>(
    c: Context<HonoCustomType>,
    header: string,
    validate: (payload: Record<string, unknown>) => T | null,
): Promise<Credential<T>> => {
    const token = c.req.raw.headers.get(header);
    if (!token) return { state: 'absent' };
    let payload: Record<string, unknown>;
    try {
        // Expiry is verified below instead of inside `Jwt.verify`, so that an expired token
        // reports as `expired` rather than collapsing into `invalid`.
        payload = await Jwt.verify(token, c.env.JWT_SECRET, { alg: 'HS256', exp: false });
    } catch {
        return { state: 'invalid' };
    }
    if (typeof payload.exp !== 'number') return { state: 'no_expiry' };
    if (payload.exp < Math.floor(Date.now() / 1000)) return { state: 'expired' };
    const validated = validate(payload);
    return validated ? { state: 'ok', payload: validated } : { state: 'invalid' };
};

/** `x-user-token` — who the caller is. Carries no permissions of its own. */
export const readUserToken = (
    c: Context<HonoCustomType>
): Promise<Credential<UserPayload>> => readCredential(c, 'x-user-token', (payload) => (
    typeof payload.user_id === 'number' && typeof payload.user_email === 'string'
        ? payload as UserPayload
        : null
));

/** `x-user-access-token` — what the caller may do. Issued by `/user_api/settings`, lives 1 hour. */
export const readAccessToken = (
    c: Context<HonoCustomType>
): Promise<Credential<AccessTokenPayload>> => readCredential(c, 'x-user-access-token', (payload) => (
    typeof payload.user_id === 'number' && typeof payload.user_role === 'string'
        ? payload as AccessTokenPayload
        : null
));

/**
 * Outside `/admin/*` every unusable access token has the same cure — drop it and fetch a fresh
 * one from `/user_api/settings` — so expired, forged and mismatched tokens share one answer.
 */
export const staleAccessTokenResponse = (c: Context<HonoCustomType>): Response => c.json({
    code: ErrorCode.AUTH_USER_ACCESS_TOKEN_EXPIRED,
    message: i18n.getMessagesbyContext(c).UserAcceesTokenExpiredMsg,
}, 401);

/**
 * Bind `x-user-token` to the request. A token that is presented must be usable; the caller is
 * left anonymous only when no token was presented and the route allows it.
 */
export const applyUserIdentity = async (
    c: Context<HonoCustomType>,
    options: { required: boolean },
): Promise<Response | void> => {
    const credential = await readUserToken(c);
    if (credential.state === 'ok') {
        c.set('userPayload', credential.payload);
        return;
    }
    if (credential.state === 'absent' && !options.required) return;
    return c.text(i18n.getMessagesbyContext(c).UserTokenExpiredMsg, 401);
};

/**
 * Resolve the caller's role into `userRolePayload`, the single source every permission check
 * reads. No token means no role; a token that is present must verify, must be unexpired, and
 * must belong to `expectedUserId` once the route knows who the caller is.
 */
export const applyUserRole = async (
    c: Context<HonoCustomType>,
    expectedUserId?: number,
): Promise<Response | void> => {
    const credential = await readAccessToken(c);
    if (credential.state === 'absent') {
        c.set('userRolePayload', null);
        return;
    }
    if (credential.state !== 'ok') return staleAccessTokenResponse(c);
    if (expectedUserId !== undefined && credential.payload.user_id !== expectedUserId) {
        return staleAccessTokenResponse(c);
    }
    c.set('userRolePayload', credential.payload.user_role);
};

/**
 * `/admin/*` keeps the rejection states distinct: an operator locked out of the console needs
 * to know which credential failed, where other routes only need the client to refresh.
 */
export const requireAdminRole = async (c: Context<HonoCustomType>): Promise<Response | void> => {
    const msgs = i18n.getMessagesbyContext(c);
    const credential = await readAccessToken(c);
    switch (credential.state) {
        case 'expired':
            return c.json({
                code: ErrorCode.AUTH_USER_ACCESS_TOKEN_EXPIRED,
                message: msgs.UserAcceesTokenExpiredMsg,
            }, 401);
        case 'no_expiry':
            return c.json({
                code: ErrorCode.AUTH_ADMIN_CREDENTIAL_INVALID,
                message: msgs.UserAcceesTokenExpiredMsg,
            }, 401);
        case 'absent':
        case 'invalid':
            return c.json({
                code: ErrorCode.AUTH_ADMIN_CREDENTIAL_INVALID,
                message: msgs.AdminLoginRequiredMsg,
            }, 401);
    }
    if (credential.payload.user_role !== getAdminRole(c)) {
        return c.json({
            code: ErrorCode.AUTH_ADMIN_CREDENTIAL_INVALID,
            message: msgs.UserRoleIsNotAdminMsg,
        }, 401);
    }
    c.set('userRolePayload', credential.payload.user_role);
};

/** `ADMIN_API_IP_WHITELIST`, once set, is a hard gate: a request we cannot place is refused. */
export const checkAdminApiIpWhitelist = (c: Context<HonoCustomType>): Response | void => {
    const whitelist = getEnvStringList(c.env.ADMIN_API_IP_WHITELIST)
        .map((ip) => ip.trim())
        .filter(Boolean);
    if (whitelist.length === 0) return;
    const reqIp = c.req.raw.headers.get('cf-connecting-ip')?.trim();
    if (!reqIp || !whitelist.includes(reqIp)) {
        return c.text(i18n.getMessagesbyContext(c).AdminApiIpNotAllowedMsg, 403);
    }
};
