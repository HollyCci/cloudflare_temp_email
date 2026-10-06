import { AxiosHeaders } from 'axios'
import { ErrorCode } from './error-codes'
import { session } from '../store/session'
import { safeBearerHeader, safeHeaderValue } from '../utils/headers'

const isCurrentSession = ({ headers }) =>
  safeHeaderValue(headers.get('x-user-token')) === safeHeaderValue(session.userJwt)
  && safeHeaderValue(headers.get('Authorization')) === safeBearerHeader(session.jwt)

/**
 * The worker answers AUTH_USER_ACCESS_TOKEN_EXPIRED for every access token it cannot use —
 * expired, forged, or issued to a different account — because they all have the same cure.
 * The error code is therefore the whole signal: which route raised it is the worker's business,
 * so this interceptor keeps no list of routes that may raise it.
 */
const matches = (path, response) => {
  if (!ErrorCode.isUserAccessTokenError(response)) return false
  const { config } = response
  if (!isCurrentSession(config)) return false
  return Boolean(safeHeaderValue(config.headers.get('x-user-access-token')))
}

async function loadUserSettings(token, client, headers) {
  // the rejected token is not presented while asking for its replacement
  const refreshHeaders = new AxiosHeaders(headers)
  refreshHeaders.delete('x-user-access-token')
  const response = await client.get('/user_api/settings', { headers: refreshHeaders })
  if (response.status >= 300) {
    throw new Error(`[${response.status}]: ${response.data?.message || response.data}`)
  }
  if (safeHeaderValue(session.userJwt) === token) {
    session.setUserSettings(response.data)
  }
  return response.data
}

export const createUserAccessTokenInterceptor = (client) => {
  // Every request that presented a rejected token gets the same replacement, whether its
  // rejection comes back before, while or after that replacement is fetched. The session is no
  // witness to that: the store applies its updates on a later render.
  let lastRejection = null

  /**
   * The rejected token is dropped from the session so later requests stop presenting it; an
   * account then gets a freshly issued token, while an address-only session has no account to
   * issue one and simply carries no role.
   */
  async function replace(rejected, headers) {
    const current = safeHeaderValue(session.userSettings.access_token)
    // the account settings were reloaded meanwhile and already hold a newer token
    if (current && current !== rejected) return current
    session.setUserSettings({ access_token: null })
    const userToken = safeHeaderValue(headers.get('x-user-token'))
    if (!userToken) return null
    const settings = await loadUserSettings(userToken, client, headers)
    return safeHeaderValue(settings?.access_token)
  }

  function replacementFor(config) {
    const rejected = safeHeaderValue(config.headers.get('x-user-access-token'))
    if (lastRejection?.token !== rejected) {
      lastRejection = { token: rejected, replacement: replace(rejected, config.headers) }
    }
    return lastRejection.replacement
  }

  return {
    matches,
    handle: async ({ config }) => {
      const accessToken = await replacementFor(config)
      if (!isCurrentSession(config)) throw new Error('User session changed, please retry')
      const headers = new AxiosHeaders(config.headers)
      headers.delete('x-user-access-token')
      if (accessToken) headers.set('x-user-access-token', accessToken)
      return await client.request({ ...config, headers })
    },
  }
}
