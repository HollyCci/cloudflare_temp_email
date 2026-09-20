import axios from 'axios'
import { toast } from '@heroui/react'
import { APP_CONFIG } from '../config'
import { session } from '../store/session'
import { getFingerprint } from '../utils/fingerprint'
import { safeBearerHeader, safeHeaderValue } from '../utils/headers'
import { sanitizeHtml } from '../utils/sanitize-html'
import { createUserAccessTokenInterceptor } from './user-access-token-interceptor'
import { ErrorCode } from './error-codes'
import { emptyOpenSettings } from '../store/session'
import type { AddressSettings, BoundAddress, MailListResponse, OpenSettings } from '../store/types'

const API_BASE = APP_CONFIG.API_BASE || ''

const instance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  validateStatus: (status) => status >= 200 && status <= 500,
})

const responseInterceptors = [createUserAccessTokenInterceptor(instance)]

const interceptResponse = async (path: string, response: any) => {
  for (const { matches, handle } of responseInterceptors) {
    if (matches(path, response)) return await handle(response)
  }
  return response
}

type FetchOptions = {
  method?: string
  body?: string | null
  showLoading?: boolean
  userJwt?: string
}

const apiFetch = async (path: string, options: FetchOptions = {}) => {
  const showLoading = options.showLoading !== false
  if (showLoading) session.setLoading(true)
  try {
    const fingerprint = await getFingerprint()
    const headers: Record<string, string> = {
      'x-lang': session.locale,
      'x-fingerprint': fingerprint,
      'Content-Type': 'application/json',
    }
    const userTokenHeader = safeHeaderValue(options.userJwt || session.userJwt)
    if (userTokenHeader) headers['x-user-token'] = userTokenHeader
    const userAccessHeader = safeHeaderValue(session.userSettings.access_token)
    if (userAccessHeader) headers['x-user-access-token'] = userAccessHeader
    const customAuthHeader = safeHeaderValue(session.auth)
    if (customAuthHeader) headers['x-custom-auth'] = customAuthHeader
    const authorizationHeader = safeBearerHeader(session.jwt)
    if (authorizationHeader) headers.Authorization = authorizationHeader

    const initialResponse = await instance.request({
      url: path,
      method: options.method || 'GET',
      data: options.body || null,
      headers,
    })
    const response = await interceptResponse(path, initialResponse)
    if (ErrorCode.isSiteAuthError(response)) session.setShowAuth(true)
    if (response.status >= 300) {
      throw new Error(`[${response.status}]: ${response.data?.message || response.data}`)
    }
    return response.data
  } catch (error: any) {
    if (error.response) {
      throw new Error(`Code ${error.response.status}: ${error.response.data?.message || error.response.data}`)
    }
    throw error
  } finally {
    if (showLoading) session.setLoading(false)
  }
}

const applyOpenSettings = (res: Record<string, any>): OpenSettings => {
  const domains = Array.isArray(res.domains) ? res.domains : []
  const domainLabels = res.domainLabels || []
  return {
    ...emptyOpenSettings,
    ...res,
    fetched: true,
    title: res.title || '',
    prefix: res.prefix || '',
    needAuth: res.needAuth || false,
    defaultDomains: res.defaultDomains || [],
    randomSubdomainDomains: res.randomSubdomainDomains || [],
    domains: domains.map((domain: string, index: number) => ({
      label: domainLabels.length > index ? domainLabels[index] : domain,
      value: domain,
    })),
    adminContact: res.adminContact || '',
    enableUserCreateEmail: res.enableUserCreateEmail || false,
    disableAnonymousUserCreateEmail: res.disableAnonymousUserCreateEmail || false,
    disableCustomAddressName: res.disableCustomAddressName || false,
    enableUserDeleteEmail: res.enableUserDeleteEmail || false,
    enableMailReadStatus: res.enableMailReadStatus === true,
    enableAutoReply: res.enableAutoReply || false,
    enableIndexAbout: res.enableIndexAbout || false,
    copyright: res.copyright || emptyOpenSettings.copyright,
    cfTurnstileSiteKey: res.cfTurnstileSiteKey || '',
    enableWebhook: res.enableWebhook || false,
    isS3Enabled: res.isS3Enabled || false,
    showGithubForUser: res.showGithubForUser ?? emptyOpenSettings.showGithubForUser,
    enableAddressPassword: res.enableAddressPassword || false,
    enableAgentEmailInfo: res.enableAgentEmailInfo || false,
    enableRedeemCode: res.enableRedeemCode || false,
    redeemCodeUrl: res.redeemCodeUrl || '',
    statusUrl: res.statusUrl || '',
    enableGlobalTurnstileCheck: res.enableGlobalTurnstileCheck || false,
  }
}

export const api = {
  fetch: apiFetch,
  async getOpenSettings(onChange: (settings: OpenSettings) => void) {
    try {
      const res = await apiFetch('/open_api/settings')
      const next = applyOpenSettings(res)
      if (!next.domains.length) toast(next.title || 'No domains', { description: 'No domains found', variant: 'danger' })
      onChange(next)
      if (res.announcement) {
        const plain = sanitizeHtml(String(res.announcement)).replace(/<[^>]+>/g, ' ').trim()
        if (plain) toast(plain)
      }
      return next
    } catch (error: any) {
      toast(error.message || 'error', { variant: 'danger' })
      const failed = { ...emptyOpenSettings, fetched: true }
      onChange(failed)
      return failed
    }
  },
  async getSettings(): Promise<AddressSettings> {
    if (!safeHeaderValue(session.jwt)) {
      return { fetched: true, address: '', send_balance: 0 }
    }
    const res = await apiFetch('/api/settings')
    return {
      fetched: true,
      address: res.address || '',
      send_balance: res.send_balance || 0,
    }
  },
  async getUserOpenSettings() {
    return await apiFetch('/user_api/open_settings')
  },
  async getUserSettings(userJwt?: string) {
    if (!safeHeaderValue(userJwt || session.userJwt)) return null
    return await apiFetch('/user_api/settings', { userJwt })
  },
  async bindUserAddress() {
    if (!session.userJwt) return
    await apiFetch('/user_api/bind_address', { method: 'POST' })
  },
  async listBoundAddresses(): Promise<{ results?: BoundAddress[] }> {
    return await apiFetch('/user_api/bind_address?limit=50&offset=0', { showLoading: false })
  },
  async openBoundAddress(id: number): Promise<{ jwt?: string }> {
    return await apiFetch(`/user_api/bind_address_jwt/${id}`, { showLoading: false })
  },
  async listMails(limit = 20, offset = 0): Promise<MailListResponse> {
    return await apiFetch(`/api/parsed_mails?limit=${limit}&offset=${offset}`, { showLoading: false })
  },
  async getMail(id: string | number) {
    return await apiFetch(`/api/parsed_mail/${id}`, { showLoading: false })
  },
  async deleteMail(id: string | number) {
    await apiFetch(`/api/mails/${id}`, { method: 'DELETE' })
  },
  async updateMailReadStatus(id: string | number, isUnread: boolean) {
    await apiFetch(`/api/mails/${id}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ isUnread }),
      showLoading: false,
    })
  },
}
