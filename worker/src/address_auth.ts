import { Context, Next } from 'hono';
import { Jwt } from 'hono/utils/jwt';

import i18n from './i18n';

export const validateAddressPayload = async (
    c: Context<HonoCustomType>,
    payload: Record<string, unknown>,
): Promise<JwtPayload | null> => {
    const { address, address_id } = payload;
    if (typeof address !== 'string' || !address) return null;
    if (typeof address_id !== 'number'
        && (typeof address_id !== 'string' || !/^\d+$/.test(address_id))
    ) return null;
    const addressId = Number(address_id);
    if (!Number.isSafeInteger(addressId) || addressId <= 0) return null;
    const exists = await c.env.DB.prepare(
        `SELECT id FROM address WHERE id = ? AND name = ?`
    ).bind(addressId, address).first<number>('id');
    return exists ? { address, address_id: addressId } : null;
};

export const verifyAddressToken = async (
    c: Context<HonoCustomType>,
    token: string,
): Promise<JwtPayload> => {
    const payload = await Jwt.verify(token, c.env.JWT_SECRET, 'HS256');
    const addressPayload = await validateAddressPayload(c, payload);
    if (!addressPayload) {
        throw new Error(i18n.getMessagesbyContext(c).InvalidAddressCredentialMsg);
    }
    return addressPayload;
};

/**
 * `Authorization: Bearer <jwt>` — the mailbox the caller holds. Mailbox credentials carry no
 * expiry, though an `exp` that is present is enforced. Every route that reads one requires it,
 * so a missing credential and an unusable one get the same 401; neither is thrown.
 */
const readAddressCredential = async (c: Context<HonoCustomType>): Promise<JwtPayload | null> => {
    const parts = c.req.raw.headers.get('Authorization')?.split(/\s+/);
    if (parts?.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    let payload: Record<string, unknown>;
    try {
        payload = await Jwt.verify(parts[1], c.env.JWT_SECRET, 'HS256');
    } catch {
        return null;
    }
    return await validateAddressPayload(c, payload);
};

export const addressJwtAuth = async (c: Context<HonoCustomType>, next: Next) => {
    const payload = await readAddressCredential(c);
    if (!payload) return c.text(i18n.getMessagesbyContext(c).InvalidAddressCredentialMsg, 401);
    c.set('jwtPayload', payload);
    await next();
};
