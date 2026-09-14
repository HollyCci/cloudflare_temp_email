export function parseSender(raw?: string) {
  const value = (raw || '').trim()
  if (!value) return { name: 'Unknown', email: '' }
  const angled = value.match(/^(.*)<([^>]+)>\s*$/)
  if (angled) {
    const email = angled[2].trim()
    const name = angled[1].replace(/["']/g, '').trim() || email.split('@')[0]
    return { name, email }
  }
  if (value.includes('@')) return { name: value.split('@')[0], email: value }
  return { name: value, email: '' }
}

export function getInitials(name: string) {
  const parts = name.split(/[\s@._-]+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '?'
}

export function mailPreview(mail: { text?: string; html?: string; subject?: string }) {
  const text = (mail.text || '').replace(/\s+/g, ' ').trim()
  if (text) return text
  const stripped = (mail.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return stripped || mail.subject || ''
}

export function compactTime(utcDate?: string) {
  if (!utcDate) return ''
  const date = new Date(`${utcDate} UTC`)
  if (Number.isNaN(date.getTime())) return utcDate
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
