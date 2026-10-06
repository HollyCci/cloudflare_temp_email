import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../client'
import { emptyUserSettings, session } from '../../store/session'

const server = vi.hoisted(() => ({ respond: null, requests: [] }))

vi.mock('@heroui/react', () => ({ toast: vi.fn() }))
vi.mock('../../utils/fingerprint', () => ({ getFingerprint: async () => 'test-fingerprint' }))
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal()
  const { AxiosError } = actual
  // Every request of the API client is answered by `server.respond(request)`.
  const adapter = async (config) => {
    const header = (name) => config.headers.get(name) ?? undefined
    const request = {
      path: config.url,
      accessToken: header('x-user-access-token'),
      userToken: header('x-user-token'),
      authorization: header('Authorization'),
    }
    server.requests.push(request)
    const reply = await server.respond(request)
    if (reply === 'network-error') throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {})
    const response = { data: reply.data ?? {}, status: reply.status ?? 200, statusText: '', headers: {}, config, request: {} }
    if (config.validateStatus(response.status)) return response
    throw new AxiosError(`Request failed with status code ${response.status}`, AxiosError.ERR_BAD_RESPONSE, config, {}, response)
  }
  return { ...actual, default: { ...actual.default, create: (options) => actual.default.create({ ...options, adapter }) } }
})

// Like the React store, setUserSettings only reaches `session` on the next render.
const store = {
  queued: [],
  render() {
    for (const next of store.queued.splice(0)) session.userSettings = { ...session.userSettings, ...next }
  },
}
const nextRender = () => new Promise((resolve) => setTimeout(resolve, 0))

// Each test session starts from its own token, as real access tokens never repeat.
let stale
let round = 0

const EXPIRED = { status: 401, data: { code: 'AUTH_USER_ACCESS_TOKEN_EXPIRED', message: 'Access token expired' } }
const FRESH = { data: { access_token: 'fresh-token' } }
const echo = (req) => ({ data: { path: req.path, token: req.accessToken } })
const refreshes = () => server.requests.filter((req) => req.path === '/user_api/settings')
const gate = () => {
  let open
  const opened = new Promise((resolve) => { open = resolve })
  return { open, opened }
}

beforeEach(() => {
  stale = `stale-token-${++round}`
  server.requests = []
  store.queued = []
  Object.assign(session, {
    jwt: 'mailbox-jwt',
    userJwt: 'account-jwt',
    auth: '',
    showAuth: false,
    userSettings: { ...emptyUserSettings, access_token: stale },
    setUserSettings: (next) => {
      store.queued.push(next)
      setTimeout(store.render, 0)
    },
    setShowAuth: (next) => { session.showAuth = next },
    setLoading: (next) => { session.loading = next },
  })
})

describe('access token replacement', () => {
  it('presents the session token and fetches nothing else when it is accepted', async () => {
    server.respond = echo
    await expect(api.fetch('/api/settings')).resolves.toEqual({ path: '/api/settings', token: stale })
    expect(server.requests).toHaveLength(1)
  })

  // The error code is the whole signal: no route list decides which rejections count.
  it.each(['/admin/db_version', '/api/settings', '/open_api/settings', '/user_api/bind_address'])(
    'replaces a token rejected by %s once and retries with the new one',
    async (path) => {
      server.respond = (req) => req.path === '/user_api/settings' ? FRESH : req.accessToken === stale ? EXPIRED : echo(req)
      await expect(api.fetch(path)).resolves.toEqual({ path, token: 'fresh-token' })
      expect(server.requests.map((req) => [req.path, req.accessToken, req.userToken])).toEqual([
        [path, stale, 'account-jwt'],
        ['/user_api/settings', undefined, 'account-jwt'],
        [path, 'fresh-token', 'account-jwt'],
      ])
      await nextRender()
      expect(session.userSettings.access_token).toBe('fresh-token')
    },
  )

  it('drops a rejected token without a refresh when no account is signed in', async () => {
    session.userJwt = ''
    server.respond = (req) => req.accessToken ? EXPIRED : echo(req)
    await expect(api.fetch('/api/settings')).resolves.toEqual({ path: '/api/settings', token: undefined })
    expect(server.requests.map((req) => req.accessToken)).toEqual([stale, undefined])
    await nextRender()
    expect(session.userSettings.access_token).toBeNull()
  })

  it.each([
    ['a plain-text 401', { status: 401, data: 'Your access token has expired' }, '[401]: Your access token has expired'],
    ['a missing admin role', { status: 401, data: { code: 'AUTH_ADMIN_CREDENTIAL_INVALID', message: 'Admin role required' } }, '[401]: Admin role required'],
    ['a client error', { status: 403, data: { code: 'OPERATION_FAILED', message: 'Operation failed' } }, '[403]: Operation failed'],
    ['a server error', { status: 500, data: 'Server error' }, '[500]: Server error'],
    ['an unavailable worker', { status: 503, data: { code: 'OPERATION_FAILED', message: 'Unavailable' } }, 'Code 503: Unavailable'],
  ])('surfaces %s unchanged and keeps the token', async (_, reply, message) => {
    server.respond = () => reply
    await expect(api.fetch('/admin/db_version')).rejects.toThrow(message)
    expect(server.requests).toHaveLength(1)
    await nextRender()
    expect(session.userSettings.access_token).toBe(stale)
  })

  it('gives up after one replacement when the new token is rejected too', async () => {
    server.respond = (req) => req.path === '/user_api/settings' ? FRESH : EXPIRED
    await expect(api.fetch('/admin/db_version')).rejects.toThrow('[401]: Access token expired')
    expect(server.requests.map((req) => req.path)).toEqual(['/admin/db_version', '/user_api/settings', '/admin/db_version'])
  })

  it('surfaces the retried request\'s own error as-is', async () => {
    server.respond = (req) => req.path === '/user_api/settings'
      ? FRESH
      : req.accessToken === stale
        ? EXPIRED
        : { status: 401, data: { code: 'AUTH_ADMIN_CREDENTIAL_INVALID', message: 'Admin role required' } }
    await expect(api.fetch('/admin/db_version')).rejects.toThrow('[401]: Admin role required')
  })

  it('shares one replacement with rejections that come back while it is being fetched', async () => {
    const refresh = gate()
    const secondRejection = gate()
    server.respond = async (req) => {
      if (req.path === '/user_api/settings') {
        await refresh.opened
        return FRESH
      }
      if (req.accessToken !== stale) return echo(req)
      if (req.path === '/admin/users') await secondRejection.opened
      return EXPIRED
    }
    const first = api.fetch('/admin/db_version')
    const second = api.fetch('/admin/users')
    await vi.waitFor(() => expect(refreshes()).toHaveLength(1))
    // The store renders the dropped token before the second rejection comes back.
    await nextRender()
    expect(session.userSettings.access_token).toBeNull()
    secondRejection.open()
    await nextRender()
    refresh.open()
    await expect(Promise.all([first, second])).resolves.toEqual([
      { path: '/admin/db_version', token: 'fresh-token' },
      { path: '/admin/users', token: 'fresh-token' },
    ])
    expect(refreshes()).toHaveLength(1)
  })

  it('hands a finished replacement to rejections that come back after it', async () => {
    const refresh = gate()
    const lateRejection = gate()
    server.respond = async (req) => {
      if (req.path === '/user_api/settings') {
        await refresh.opened
        return FRESH
      }
      if (req.accessToken !== stale) return echo(req)
      if (req.path === '/api/send_mail') await lateRejection.opened
      return EXPIRED
    }
    const early = api.fetch('/api/settings')
    const late = api.fetch('/api/send_mail', { method: 'POST' })
    await vi.waitFor(() => expect(refreshes()).toHaveLength(1))
    await nextRender()
    refresh.open()
    await expect(early).resolves.toEqual({ path: '/api/settings', token: 'fresh-token' })
    // The new token is issued but not rendered into the session yet.
    expect(session.userSettings.access_token).toBeNull()
    lateRejection.open()
    await expect(late).resolves.toEqual({ path: '/api/send_mail', token: 'fresh-token' })
    expect(refreshes()).toHaveLength(1)
  })

  it.each([
    [400, { status: 400, data: 'Refresh failed' }, '[400]: Refresh failed'],
    [401, { status: 401, data: { message: 'Please login again' } }, '[401]: Please login again'],
    [500, { status: 500, data: 'Refresh failed' }, '[500]: Refresh failed'],
    ['network', 'network-error', 'Network Error'],
  ])('fails the request when no replacement can be fetched (%s)', async (_, reply, message) => {
    server.respond = (req) => req.path === '/user_api/settings' ? reply : EXPIRED
    await expect(api.fetch('/api/settings')).rejects.toThrow(message)
    expect(server.requests.map((req) => req.path)).toEqual(['/api/settings', '/user_api/settings'])
    await nextRender()
    expect(session.userSettings.access_token).toBeNull()
  })

  it.each([
    ['account', () => {
      session.userJwt = 'other-account'
      session.setUserSettings({ access_token: 'other-token' })
    }, 'other-token'],
    ['mailbox', () => { session.jwt = 'other-mailbox' }, 'fresh-token'],
  ])('stops a request whose %s changed while its replacement was fetched', async (_, change, tokenAfter) => {
    server.respond = (req) => {
      if (req.path !== '/user_api/settings') return EXPIRED
      change()
      return FRESH
    }
    await expect(api.fetch('/api/send_mail', { method: 'POST' })).rejects.toThrow('User session changed, please retry')
    expect(server.requests.map((req) => req.path)).toEqual(['/api/send_mail', '/user_api/settings'])
    await nextRender()
    expect(session.userSettings.access_token).toBe(tokenAfter)
  })
})

describe('site password', () => {
  it.each([
    ['opens', { status: 401, data: { code: 'AUTH_SITE_PASSWORD_INVALID', message: 'Site password required' } }, true],
    ['stays closed for', { status: 401, data: { code: 'AUTH_ADMIN_CREDENTIAL_INVALID', message: 'Admin role required' } }, false],
  ])('the dialog %s the matching error code', async (_, reply, shown) => {
    server.respond = () => reply
    await expect(api.fetch('/admin/db_version')).rejects.toThrow(reply.data.message)
    expect(session.showAuth).toBe(shown)
  })
})

describe('mailbox binding', () => {
  it('binds the mailbox it is given, not the one the store still shows', async () => {
    server.respond = () => ({ data: { success: true } })
    await api.bindUserAddress('created-mailbox-jwt')
    expect(server.requests.map((req) => [req.path, req.authorization])).toEqual([
      ['/user_api/bind_address', 'Bearer created-mailbox-jwt'],
    ])
  })
})
