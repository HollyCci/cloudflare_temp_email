import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { session } from '../store/session'

export const getFingerprint = async (): Promise<string> => {
  if (session.fingerprint) return session.fingerprint
  try {
    const fp = await FingerprintJS.load()
    const result = await fp.get()
    session.fingerprint = result.visitorId
    return session.fingerprint
  } catch (error) {
    console.error('Failed to get fingerprint:', error)
    session.fingerprint = 'ERROR'
    return session.fingerprint
  }
}
