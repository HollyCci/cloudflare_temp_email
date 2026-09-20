export type DomainOption = {
  label: string
  value: string
}

export type OpenSettings = {
  fetched: boolean
  title: string
  announcement: string
  alwaysShowAnnouncement: boolean
  prefix: string
  addressRegex: string
  needAuth: boolean
  adminContact: string
  enableUserCreateEmail: boolean
  disableAnonymousUserCreateEmail: boolean
  disableCustomAddressName: boolean
  enableUserDeleteEmail: boolean
  enableMailReadStatus: boolean
  enableAutoReply: boolean
  enableIndexAbout: boolean
  defaultDomains: string[]
  randomSubdomainDomains: string[]
  domains: DomainOption[]
  copyright: string
  cfTurnstileSiteKey: string
  enableWebhook: boolean
  isS3Enabled: boolean
  enableSendMail: boolean
  showGithub: boolean
  showGithubForUser: boolean
  enableAddressPassword: boolean
  enableAgentEmailInfo: boolean
  enableRedeemCode: boolean
  redeemCodeUrl: string
  statusUrl: string
  enableGlobalTurnstileCheck: boolean
}

export type UserOpenSettings = {
  fetched: boolean
  enable: boolean
  enableMailVerify: boolean
  oauth2ClientIDs: { clientID: string; name: string; icon?: string }[]
}

export type UserSettings = {
  fetched: boolean
  user_email: string
  user_id: number
  is_admin: boolean
  access_token: string | null
  new_user_token: string | null
  user_role: {
    domains?: string[] | null
    role?: string
    prefix?: string | null
  } | null
}

export type AddressSettings = {
  fetched: boolean
  address: string
  send_balance: number
}

export type BoundAddress = {
  id: number
  name: string
  mail_count?: number
  send_count?: number
  created_at?: string
  updated_at?: string
}

export type Mail = {
  id: number | string
  address?: string
  source?: string
  sender?: string
  subject?: string
  text?: string
  html?: string
  message?: string
  created_at?: string
  is_unread?: number
}

export type MailListResponse = {
  results: Mail[]
  count: number
}
