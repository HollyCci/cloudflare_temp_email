import { describe, expect, it } from 'vitest'
import { compactTime, getInitials, mailPreview, parseSender, avatarFor } from '../mail'

describe('parseSender', () => {
  it('splits display name and email', () => {
    expect(parseSender('Ada Lovelace <ada@example.com>')).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    })
  })

  it('uses the local part when only an address is present', () => {
    expect(parseSender('ada@example.com')).toEqual({
      name: 'ada',
      email: 'ada@example.com',
    })
  })
})

describe('mail helpers', () => {
  it('builds initials from the first two tokens', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL')
    expect(getInitials('Cursor')).toBe('C')
  })

  it('assigns a stable template avatar for a mailbox', () => {
    const first = avatarFor('9vvgp7k4k7@cursor.wocc.rs')
    const second = avatarFor('9vvgp7k4k7@cursor.wocc.rs')
    expect(first).toBe(second)
    expect(first).toMatch(/^https:\/\/(heroui-assets\.nyc3\.cdn\.digitaloceanspaces\.com|img\.heroui\.chat)\//)
    expect(avatarFor('other@cursor.wocc.rs')).toMatch(/^https:\/\//)
  })

  it('prefers plain text for the list preview', () => {
    expect(mailPreview({ text: '  hello   world  ', html: '<p>ignored</p>' })).toBe('hello world')
  })

  it('returns a time of day for messages from today', () => {
    const now = new Date()
    const stamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:00`
    expect(compactTime(stamp)).toMatch(/\d/)
  })
})
