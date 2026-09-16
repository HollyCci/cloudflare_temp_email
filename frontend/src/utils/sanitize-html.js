import DOMPurify from 'dompurify';
import { ALLOWED_URI_REGEXP } from './remote-content-policy';

const NAVIGATION_HREF_ELEMENTS = new Set(['A', 'AREA']);

export const sanitizeHtml = (html) => {
    return DOMPurify.sanitize(typeof html === 'string' ? html : '', {
        ALLOWED_URI_REGEXP,
    });
};

let mailPurifier = null;

const getMailPurifier = () => {
    if (mailPurifier) return mailPurifier;
    mailPurifier = DOMPurify(typeof window === 'undefined' ? undefined : window);
    mailPurifier.addHook('uponSanitizeAttribute', (node, data) => {
        if (data.attrName !== 'href' && data.attrName !== 'xlink:href') return;
        if (!NAVIGATION_HREF_ELEMENTS.has(node.tagName)) return;
        if (/^data:/i.test(String(data.attrValue || '').trim())) {
            data.keepAttr = false;
        }
    });
    return mailPurifier;
};

export const sanitizeMailHtml = (html) => {
    return getMailPurifier().sanitize(typeof html === 'string' ? html : '', {
        ALLOWED_URI_REGEXP,
        ADD_TAGS: ['style'],
        FORCE_BODY: true,
        FORBID_TAGS: [
            'base', 'meta', 'script', 'link', 'iframe', 'frame', 'frameset',
            'object', 'embed', 'noscript', 'template', 'portal', 'form',
        ],
    });
};
