const HTTP_URL = /^http:\/\//i

export function tameMailCss(css: string): string {
  return css
    .replace(/:host\b/gi, '.mail-host')
    .replace(/position\s*:\s*(fixed|sticky)/gi, 'position:relative')
    .replace(/z-index\s*:\s*[^;}]+/gi, 'z-index:auto')
}

export function rewriteMailImageUrls(root: ParentNode) {
  for (const img of root.querySelectorAll('img')) {
    img.setAttribute('referrerpolicy', 'no-referrer')
    img.setAttribute('decoding', 'async')
    const src = img.getAttribute('src') || ''
    if (src.startsWith('//')) {
      img.setAttribute('src', `https:${src}`)
    } else if (HTTP_URL.test(src)) {
      img.setAttribute('src', `https://${src.slice(7)}`)
    }
  }
}

export function tameMailDom(root: ParentNode) {
  for (const node of root.querySelectorAll('[style]')) {
    const style = node.getAttribute('style')
    if (style) node.setAttribute('style', tameMailCss(style))
  }
  for (const node of root.querySelectorAll('style')) {
    node.textContent = tameMailCss(node.textContent || '')
  }
}

export function prepareMailHtmlString(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  tameMailDom(template.content)
  rewriteMailImageUrls(template.content)
  return template.innerHTML
}

export function hideBrokenMailImages(root: ParentNode) {
  for (const img of root.querySelectorAll('img')) {
    img.addEventListener('error', () => {
      img.style.display = 'none'
    })
  }
}
