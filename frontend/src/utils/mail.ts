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

const AVATARS = [
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg',
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg',
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg',
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg',
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg',
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/black.jpg',
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/white.jpg',
  'https://img.heroui.chat/image/avatar?w=400&h=400&u=3',
  'https://img.heroui.chat/image/avatar?w=400&h=400&u=4',
  'https://img.heroui.chat/image/avatar?w=400&h=400&u=5',
  'https://img.heroui.chat/image/avatar?w=400&h=400&u=8',
  'https://img.heroui.chat/image/avatar?w=400&h=400&u=16',
] as const

function hashSeed(seed?: string) {
  const key = (seed || '').trim().toLowerCase() || '?'
  let hash = 2166136261
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function avatarFor(seed?: string) {
  return AVATARS[hashSeed(seed) % AVATARS.length]
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
