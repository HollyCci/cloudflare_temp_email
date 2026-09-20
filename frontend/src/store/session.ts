import type { UserSettings, OpenSettings } from './types'

export type Session = {
  locale: string
  jwt: string
  userJwt: string
  auth: string
  fingerprint: string
  userSettings: UserSettings
  openSettings: OpenSettings
  showAuth: boolean
  loading: boolean
  setUserSettings: (next: Partial<UserSettings>) => void
  setShowAuth: (next: boolean) => void
  setLoading: (next: boolean) => void
}

const defaultUserSettings: UserSettings = {
  fetched: false,
  user_email: '',
  user_id: 0,
  is_admin: false,
  access_token: null,
  new_user_token: null,
  user_role: null,
}

const defaultOpenSettings: OpenSettings = {
  fetched: false,
  title: '',
  announcement: '',
  alwaysShowAnnouncement: false,
  prefix: '',
  addressRegex: '',
  needAuth: false,
  adminContact: '',
  enableUserCreateEmail: false,
  disableAnonymousUserCreateEmail: false,
  disableCustomAddressName: false,
  enableUserDeleteEmail: false,
  enableMailReadStatus: false,
  enableAutoReply: false,
  enableIndexAbout: false,
  defaultDomains: [],
  randomSubdomainDomains: [],
  domains: [],
  copyright: 'Dream Hunter',
  cfTurnstileSiteKey: '',
  enableWebhook: false,
  isS3Enabled: false,
  enableSendMail: false,
  showGithub: true,
  showGithubForUser: true,
  enableAddressPassword: false,
  enableAgentEmailInfo: false,
  enableRedeemCode: false,
  redeemCodeUrl: '',
  statusUrl: '',
  enableGlobalTurnstileCheck: false,
}

export const session: Session = {
  locale: 'zh',
  jwt: '',
  userJwt: '',
  auth: '',
  fingerprint: '',
  userSettings: { ...defaultUserSettings },
  openSettings: { ...defaultOpenSettings },
  showAuth: false,
  loading: false,
  setUserSettings: () => {},
  setShowAuth: () => {},
  setLoading: () => {},
}

export const emptyUserSettings = defaultUserSettings
export const emptyOpenSettings = defaultOpenSettings
