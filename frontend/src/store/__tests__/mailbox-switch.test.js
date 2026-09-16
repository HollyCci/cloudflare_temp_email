import { describe, expect, it } from 'vitest'
import { createMailboxSwitchController, shouldApplyMailLoad } from '../mailbox-switch'

describe('createMailboxSwitchController', () => {
  it('rejects a stale generation after a newer switch starts', () => {
    const sw = createMailboxSwitchController()
    const first = sw.begin('a@x')
    const second = sw.begin('b@x')
    expect(sw.isLive(first)).toBe(false)
    expect(sw.isLive(second)).toBe(true)
    expect(sw.address).toBe('b@x')
  })

  it('clearIfLive only clears the current generation', () => {
    const sw = createMailboxSwitchController()
    const first = sw.begin('a@x')
    sw.begin('b@x')
    expect(sw.clearIfLive(first)).toBe(false)
    expect(sw.address).toBe('b@x')
  })

  it('invalidate drops in-flight switches so login can open a bound mailbox', () => {
    const sw = createMailboxSwitchController()
    const gen = sw.begin('anon@x')
    sw.invalidate()
    expect(sw.isLive(gen)).toBe(false)
    expect(sw.address).toBe('')
  })
})

describe('shouldApplyMailLoad', () => {
  it('drops a late response after the jwt has already changed', () => {
    expect(shouldApplyMailLoad({
      requestJwt: 'jwt-a',
      currentJwt: 'jwt-b',
      switchingAddress: '',
      settingsAddress: 'a@x',
    })).toBe(false)
  })

  it('drops a response for the wrong mailbox while a switch is in flight', () => {
    expect(shouldApplyMailLoad({
      requestJwt: 'jwt-a',
      currentJwt: 'jwt-a',
      switchingAddress: 'b@x',
      settingsAddress: 'a@x',
    })).toBe(false)
  })

  it('applies when the jwt is still current', () => {
    expect(shouldApplyMailLoad({
      requestJwt: 'jwt-b',
      currentJwt: 'jwt-b',
      switchingAddress: '',
      settingsAddress: 'b@x',
    })).toBe(true)
  })
})
