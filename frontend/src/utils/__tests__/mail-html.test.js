// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { prepareMailHtmlString, rewriteMailImageUrls, tameMailCss } from '../mail-html'

describe('rewriteMailImageUrls', () => {
  it('blocks referrers and upgrades insecure image URLs', () => {
    const host = document.createElement('div')
    host.innerHTML = [
      '<img id="remote" src="https://cdn.example/logo.png">',
      '<img id="http" src="http://cdn.example/logo.png">',
      '<img id="proto" src="//cdn.example/logo.png">',
    ].join('')

    rewriteMailImageUrls(host)

    for (const img of host.querySelectorAll('img')) {
      expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    }
    expect(host.querySelector('#http')?.getAttribute('src')).toBe('https://cdn.example/logo.png')
    expect(host.querySelector('#proto')?.getAttribute('src')).toBe('https://cdn.example/logo.png')
  })
})

describe('prepareMailHtmlString', () => {
  it('puts referrerpolicy on images before the string is inserted', () => {
    const html = prepareMailHtmlString('<img src="https://cdn.example/logo.png">')
    expect(html).toContain('referrerpolicy="no-referrer"')
    expect(html).toContain('src="https://cdn.example/logo.png"')
  })
})

describe('tameMailCss', () => {
  it('stops mail CSS from covering the mailbox chrome', () => {
    expect(tameMailCss(':host{position:fixed;z-index:999999}')).not.toMatch(/:host\b/)
    expect(tameMailCss('div{position:fixed}')).toContain('position:relative')
  })
})

