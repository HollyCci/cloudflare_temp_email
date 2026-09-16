// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { sanitizeHtml, sanitizeMailHtml } from '../sanitize-html';

describe('sanitizeHtml', () => {
    it('preserves safe announcement markup', () => {
        expect(sanitizeHtml('<strong>Notice</strong>')).toBe('<strong>Notice</strong>');
    });

    it('removes executable markup and unsafe attributes', () => {
        const sanitized = sanitizeHtml(
            '<script>alert(1)</script><img src="x" onerror="alert(1)">'
        );

        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).toContain('<img src="x">');
    });

    it('returns an empty string for non-string values', () => {
        expect(sanitizeHtml(null)).toBe('');
        expect(sanitizeHtml({ value: '<strong>unsafe ref</strong>' })).toBe('');
    });
});

describe('sanitizeMailHtml', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';

    it('keeps rewritten cid images as data URLs', () => {
        expect(sanitizeMailHtml(`<img src="${png}" alt="logo">`)).toContain(png);
    });

    it('keeps https images used by hosted logos', () => {
        expect(sanitizeMailHtml('<img src="https://cursor.com/logo.png">'))
            .toContain('https://cursor.com/logo.png');
    });

    it('does not allow javascript or data HTML on links', () => {
        const sanitized = sanitizeMailHtml(
            '<a href="javascript:alert(1)">x</a><a href="data:text/html,hi">y</a>'
        );
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('data:text/html');
    });

    it('does not allow data image URLs on links', () => {
        const svg = 'data:image/svg+xml;base64,PHN2Zy48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+';
        const sanitized = sanitizeMailHtml(`<a href="${svg}">x</a><img src="${png}">`);
        expect(sanitized).not.toContain('href="data:image');
        expect(sanitized).toContain(`src="${png}"`);
    });
});

