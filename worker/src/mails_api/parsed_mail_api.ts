import { Context } from 'hono'

import { commonParseMail, handleMailListQuery, updateAddressUpdatedAt } from '../common'
import { resolveRawEmailRow } from '../gzip'
import type { RawMailRow } from '../models'
import { embedCidImages } from '../utils/embed_cid'

const toParsedMailRow = async (row: Record<string, unknown>): Promise<Record<string, unknown>> => {
    // strip `raw` from the response; a row whose parse fails still returns its metadata with an empty body
    const { raw, ...rest } = row;
    let parsed: Awaited<ReturnType<typeof commonParseMail>>;
    let html: string;
    try {
        parsed = typeof raw === 'string' && raw ? await commonParseMail({ rawEmail: raw }) : undefined;
        html = embedCidImages(parsed?.html ?? '', parsed?.attachments);
    } catch {
        parsed = undefined;
        html = '';
    }
    return {
        ...rest,
        sender: parsed?.sender?.trim() ?? '',
        subject: parsed?.subject ?? '',
        text: parsed?.text ?? '',
        html,
        attachments: (parsed?.attachments ?? []).map(a => ({
            filename: a.filename,
            mimeType: a.mimeType,
            disposition: a.disposition,
            size: a.content?.length ?? 0,
        })),
    };
};

const listParsedMails = async (c: Context<HonoCustomType>) => {
    const { address } = c.get("jwtPayload");
    if (!address) return c.json({ "error": "No address" }, 400);
    const { limit, offset } = c.req.query();
    if (Number.parseInt(offset) <= 0) updateAddressUpdatedAt(c, address);
    const listRes = await handleMailListQuery(c,
        `SELECT * FROM raw_mails where address = ?`,
        `SELECT count(*) as count FROM raw_mails where address = ?`,
        [address], limit, offset
    );
    if (listRes.status !== 200) return listRes;
    const { results, count } = await listRes.json() as { results: Record<string, unknown>[], count: number };
    const parsed = await Promise.all(results.map(toParsedMailRow));
    return c.json({ results: parsed, count });
};

const getParsedMail = async (c: Context<HonoCustomType>) => {
    const { address } = c.get("jwtPayload");
    const { mail_id } = c.req.param();
    const row = await c.env.DB.prepare(
        `SELECT * FROM raw_mails where id = ? and address = ?`
    ).bind(mail_id, address).first<RawMailRow>();
    if (!row) return c.json(null);
    const resolved = await resolveRawEmailRow(row);
    return c.json(await toParsedMailRow(resolved));
};

export default { listParsedMails, getParsedMail };
