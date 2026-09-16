export type MailboxSwitchController = {
  readonly address: string
  readonly generation: number
  begin: (address: string) => number
  isLive: (generation: number) => boolean
  clearIfLive: (generation: number) => boolean
  clear: () => void
  invalidate: () => void
}

export function createMailboxSwitchController(): MailboxSwitchController {
  let generation = 0
  let address = ''
  return {
    get address() {
      return address
    },
    get generation() {
      return generation
    },
    begin(next: string) {
      generation += 1
      address = next
      return generation
    },
    isLive(token: number) {
      return token === generation
    },
    clearIfLive(token: number) {
      if (token !== generation) return false
      address = ''
      return true
    },
    clear() {
      address = ''
    },
    invalidate() {
      generation += 1
      address = ''
    },
  }
}

export function shouldApplyMailLoad({
  requestJwt,
  currentJwt,
  switchingAddress,
  settingsAddress,
}: {
  requestJwt: string
  currentJwt: string
  switchingAddress: string
  settingsAddress: string
}) {
  if (!requestJwt || requestJwt !== currentJwt) return false
  if (switchingAddress && settingsAddress !== switchingAddress) return false
  return true
}

