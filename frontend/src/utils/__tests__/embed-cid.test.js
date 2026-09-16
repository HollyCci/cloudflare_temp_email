import { describe, expect, it } from 'vitest'
import { embedCidImages, normalizeCid } from '../../../../worker/src/utils/embed_cid'

const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])

describe('embedCidImages', () => {
  it('normalizes bracketed Content-IDs', () => {
    expect(normalizeCid('<logo@cursor>')).toBe('logo@cursor')
    expect(normalizeCid('cid:logo@cursor')).toBe('logo@cursor')
  })

  it('rewrites cid images into data URLs', () => {
    const html = embedCidImages(
      '<img src="cid:logo@cursor" alt="Cursor"><p>code</p>',
      [{
        filename: 'logo.png',
        mimeType: 'image/png',
        disposition: 'inline',
        contentId: '<logo@cursor>',
        content: pngBytes,
      }],
    )

    expect(html).toContain('data:image/png;base64,')
    expect(html).not.toContain('cid:')
    expect(html).toContain('alt="Cursor"')
  })

  it('matches cid tokens without the domain suffix', () => {
    const html = embedCidImages(
      '<img src="cid:logo">',
      [{
        filename: 'logo.png',
        mimeType: 'image/png',
        disposition: 'inline',
        contentId: 'logo@cursor.com',
        content: pngBytes,
      }],
    )
    expect(html.startsWith('<img src="data:image/png;base64,')).toBe(true)
  })

  it('leaves html unchanged when there is no cid token', () => {
    const html = '<p>hello</p>'
    const same = embedCidImages(html, [{
      filename: 'logo.png',
      mimeType: 'image/png',
      disposition: 'inline',
      contentId: '<logo@cursor>',
      content: pngBytes,
    }])
    expect(same).toBe(html)
  })

  it('does not rewrite cid tokens outside image sources', () => {
    const html = embedCidImages(
      '<a href="https://docs.example/cid:logo@cursor">docs</a><a href="cid:logo@cursor">raw</a>',
      [{
        filename: 'logo.png',
        mimeType: 'image/png',
        disposition: 'inline',
        contentId: '<logo@cursor>',
        content: pngBytes,
      }],
    )
    expect(html).toContain('https://docs.example/cid:logo@cursor')
    expect(html).toContain('href="cid:logo@cursor"')
    expect(html).not.toContain('data:image')
  })

  it('does not embed svg as a data URL', () => {
    const html = embedCidImages(
      '<img src="cid:logo@cursor">',
      [{
        filename: 'logo.svg',
        mimeType: 'image/svg+xml',
        disposition: 'inline',
        contentId: '<logo@cursor>',
        content: pngBytes,
      }],
    )
    expect(html).toContain('cid:logo@cursor')
    expect(html).not.toContain('data:')
  })

  it('does not match a different domain via the local-part alias', () => {
    const html = embedCidImages(
      '<img src="cid:logo@victim.com">',
      [{
        filename: 'logo.png',
        mimeType: 'image/png',
        disposition: 'inline',
        contentId: 'logo@evil.com',
        content: pngBytes,
      }],
    )
    expect(html).toContain('cid:logo@victim.com')
    expect(html).not.toContain('data:image')
  })
})

