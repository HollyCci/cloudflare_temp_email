import { useEffect, useRef } from 'react'
import { sanitizeMailHtml } from '../utils/sanitize-html'
import { hideBrokenMailImages, prepareMailHtmlString } from '../utils/mail-html'

export function MailHtml({
  html,
  isDark,
}: {
  html: string
  isDark: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const prepared = prepareMailHtmlString(sanitizeMailHtml(html))
    let root = host.shadowRoot
    if (!root) {
      try {
        root = host.attachShadow({ mode: 'open' })
      } catch {
        host.innerHTML = prepared
        hideBrokenMailImages(host)
        return
      }
    }
    const color = isDark ? '#f4f4f5' : '#18181b'
    root.innerHTML = `<style>:host{color:${color};font:14px/1.6 ui-sans-serif,system-ui,sans-serif;contain:layout paint;overflow:auto;position:relative;display:block;}a{color:var(--accent,#006FEE);}img{max-width:100%;height:auto;}</style>${prepared}`
    hideBrokenMailImages(root)
  }, [html, isDark])

  return <div ref={hostRef} className="mail-body min-h-24" />
}
