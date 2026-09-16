const MAX_INLINE_BYTES = 256 * 1024
const MAX_TOTAL_BYTES = 1024 * 1024
const MAX_INLINE_IMAGES = 16
const SAFE_INLINE_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
])

const encodeBase64 = (value: Uint8Array): string => {
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < value.length; i += chunk) {
        binary += String.fromCharCode(...value.subarray(i, i + chunk))
    }
    return btoa(binary)
}

type CidAttachment = {
    contentId?: string
    mimeType?: string
    content?: Uint8Array
}

const normalizeMime = (value: string): string => {
    const mime = value.split(';')[0].trim().toLowerCase()
    return mime === 'image/jpg' ? 'image/jpeg' : mime
}

export const normalizeCid = (value: string): string => {
    let cid = value.trim()
    try {
        cid = decodeURIComponent(cid)
    } catch {
        // keep the raw token when it is not URI-encoded
    }
    return cid
        .replace(/^cid:/i, '')
        .replace(/^<|>$/g, '')
        .replace(/^["']|["']$/g, '')
        .toLowerCase()
}

const collectImageCids = (html: string): Set<string> => {
    const found = new Set<string>()
    const add = (raw: string) => {
        const normalized = normalizeCid(raw)
        if (normalized) found.add(normalized)
    }
    const imgSrc = /<img\b[^>]*?\bsrc\s*=\s*["']cid:([^"']+)["']/gi
    const srcset = /\bsrcset\s*=\s*["']([^"']+)["']/gi
    const cssUrl = /url\(\s*['"]?cid:([^'")\s]+)['"]?\s*\)/gi
    for (const match of html.matchAll(imgSrc)) add(match[1])
    for (const match of html.matchAll(srcset)) {
        for (const part of match[1].split(',')) {
            const token = part.trim().split(/\s+/)[0]
            if (/^cid:/i.test(token)) add(token)
        }
    }
    for (const match of html.matchAll(cssUrl)) add(match[1])
    return found
}

export const embedCidImages = (
    html: string,
    attachments: CidAttachment[] = [],
): string => {
    if (!html || attachments.length === 0) return html
    if (!/cid:/i.test(html)) return html
    const wanted = collectImageCids(html)
    if (wanted.size === 0) return html

    const byCid = new Map<string, string>()
    let total = 0
    let count = 0

    for (const attachment of attachments) {
        if (count >= MAX_INLINE_IMAGES) break
        if (!attachment.contentId || !attachment.content?.length) continue
        if (attachment.content.length > MAX_INLINE_BYTES) continue
        const mime = normalizeMime(attachment.mimeType || '')
        if (!SAFE_INLINE_IMAGE_TYPES.has(mime)) continue
        const normalized = normalizeCid(attachment.contentId)
        const local = normalized.split('@')[0]
        const referenced = wanted.has(normalized) || Boolean(local && wanted.has(local))
        if (!referenced) continue
        if (total + attachment.content.length > MAX_TOTAL_BYTES) continue
        const dataUrl = `data:${mime};base64,${encodeBase64(attachment.content)}`
        byCid.set(normalized, dataUrl)
        if (local && local !== normalized) byCid.set(local, dataUrl)
        total += attachment.content.length
        count += 1
    }
    if (byCid.size === 0) return html

    // byCid holds both the full Content-ID and its local part, so one exact lookup covers both forms
    const replaceCid = (raw: string) => byCid.get(normalizeCid(raw))
    let next = html.replace(/(<img\b[^>]*?\bsrc\s*=\s*["'])cid:([^"']+)(["'])/gi, (all, pre, raw, post) => {
        const data = replaceCid(raw)
        return data ? `${pre}${data}${post}` : all
    })
    next = next.replace(/(\bsrcset\s*=\s*["'])([^"']*)(["'])/gi, (all, pre, value, post) => {
        const rewritten = value.replace(/cid:([^,\s]+)/gi, (token: string, raw: string) => replaceCid(raw) || token)
        return `${pre}${rewritten}${post}`
    })
    next = next.replace(/url\(\s*(['"]?)cid:([^'")]+)(\1)\s*\)/gi, (all, quote, raw) => {
        const data = replaceCid(raw)
        return data ? `url(${quote}${data}${quote})` : all
    })
    return next
}
