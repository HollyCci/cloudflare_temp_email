import { useEffect, useRef } from 'react'
import { sanitizeHtml } from '../utils/sanitize-html'
import { blockRemoteContent } from '../utils/remote-content-policy'

export function MailHtml({
  html,
  isDark,
  allowRemote,
}: {
  html: string
  isDark: boolean
  allowRemote: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const prepared = allowRemote
    ? sanitizeHtml(html)
    : blockRemoteContent(sanitizeHtml(html)).html

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let root = host.shadowRoot
    if (!root) {
      try {
        root = host.attachShadow({ mode: 'open' })
      } catch {
        host.innerHTML = prepared
        return
      }
    }
    const color = isDark ? '#f4f4f5' : '#18181b'
    root.innerHTML = `<style>:host{color:${color};font:14px/1.6 ui-sans-serif,system-ui,sans-serif;}a{color:var(--accent,#006FEE);}img{max-width:100%;height:auto;}</style>${prepared}`
  }, [prepared, isDark])

  return <div ref={hostRef} className="mail-body min-h-24" />
}
