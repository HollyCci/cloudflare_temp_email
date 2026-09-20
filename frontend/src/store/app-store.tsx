import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from '@heroui/react'
import { api } from '../api/client'
import { session, emptyOpenSettings, emptyUserSettings } from './session'
import { createMailboxSwitchController } from './mailbox-switch'
import type { AddressSettings, BoundAddress, OpenSettings, UserOpenSettings, UserSettings } from './types'
import {
  DEFAULT_LOCALE,
  type Locale,
} from '../i18n/locale'

const readRaw = (key: string) => {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

const writeRaw = (key: string, value: string) => {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // ignore quota / private mode
  }
}

const readTheme = () => {
  const stored = readRaw('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

type AppState = {
  locale: Locale
  setLocale: (locale: Locale) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  jwt: string
  setJwt: (value: string) => void
  userJwt: string
  setUserJwt: (value: string) => void
  auth: string
  setAuth: (value: string) => void
  loading: boolean
  setLoading: (value: boolean) => void
  showAuth: boolean
  setShowAuth: (value: boolean) => void
  openSettings: OpenSettings
  setOpenSettings: (value: OpenSettings) => void
  userOpenSettings: UserOpenSettings
  setUserOpenSettings: (value: UserOpenSettings) => void
  userSettings: UserSettings
  setUserSettings: (value: Partial<UserSettings>) => void
  addressSettings: AddressSettings
  setAddressSettings: (value: AddressSettings) => void
  addresses: BoundAddress[]
  setAddresses: (value: BoundAddress[]) => void
  addressesFetched: boolean
  setAddressesFetched: (value: boolean) => void
  switchingAddress: string
  addressOpenFailed: boolean
  /** Bumped whenever a mailbox JWT is applied, so the inbox reloads even if the JWT is unchanged. */
  inboxEpoch: number
  /** Fetches the bound address's JWT and applies it. Resolves true if the JWT was applied. */
  openMailbox: (target: { id: number; name: string }) => Promise<boolean>
  finishAddressSwitch: (address: string) => void
  invalidateAddressSwitch: () => void
  /** True when the signed-in account holds the admin role. Admin access is role-based only. */
  showAdminPage: boolean
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [theme, setTheme] = useState<'light' | 'dark'>(readTheme)
  const [jwt, setJwtState] = useState(() => readRaw('jwt'))
  const [userJwt, setUserJwtState] = useState(() => readRaw('userJwt'))
  const [auth, setAuthState] = useState(() => readRaw('auth'))
  const [loading, setLoading] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [openSettings, setOpenSettings] = useState<OpenSettings>({ ...emptyOpenSettings })
  const [userOpenSettings, setUserOpenSettings] = useState<UserOpenSettings>({
    fetched: false,
    enable: false,
    enableMailVerify: false,
    oauth2ClientIDs: [],
  })
  const [userSettings, setUserSettingsState] = useState<UserSettings>({ ...emptyUserSettings })
  const [addressSettings, setAddressSettings] = useState<AddressSettings>({
    fetched: false,
    address: '',
    send_balance: 0,
  })
  const [addresses, setAddresses] = useState<BoundAddress[]>([])
  const [addressesFetched, setAddressesFetched] = useState(() => !readRaw('userJwt'))
  const [switchingAddress, setSwitchingAddressState] = useState('')
  const [addressOpenFailed, setAddressOpenFailed] = useState(false)
  const [inboxEpoch, setInboxEpoch] = useState(0)
  const [mailboxSwitch] = useState(() => createMailboxSwitchController())

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
  }, [])
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      writeRaw('theme', next)
      return next
    })
  }, [])
  const setJwt = useCallback((value: string) => {
    setJwtState(value)
    writeRaw('jwt', value)
  }, [])
  const openMailbox = useCallback(async (target: { id: number; name: string }) => {
    const generation = mailboxSwitch.begin(target.name)
    setSwitchingAddressState(target.name)
    setAddressOpenFailed(false)
    // Only the newest switch may mutate state; a superseded one exits silently.
    const cancel = () => {
      if (!mailboxSwitch.clearIfLive(generation)) return false
      setSwitchingAddressState('')
      setAddressOpenFailed(true)
      return true
    }
    try {
      const res = await api.openBoundAddress(target.id)
      if (!res.jwt || !mailboxSwitch.isLive(generation)) {
        cancel()
        return false
      }
      setJwt(res.jwt)
      setInboxEpoch((epoch) => epoch + 1)
      return true
    } catch (error: any) {
      if (cancel()) toast(error.message, { variant: 'danger' })
      return false
    }
  }, [mailboxSwitch, setJwt])
  const finishAddressSwitch = useCallback((address: string) => {
    if (mailboxSwitch.address && mailboxSwitch.address !== address) return
    mailboxSwitch.clear()
    setSwitchingAddressState('')
  }, [mailboxSwitch])
  const invalidateAddressSwitch = useCallback(() => {
    mailboxSwitch.invalidate()
    setSwitchingAddressState('')
  }, [mailboxSwitch])
  const setUserJwt = useCallback((value: string) => {
    setUserJwtState(value)
    writeRaw('userJwt', value)
  }, [])
  const setAuth = useCallback((value: string) => {
    setAuthState(value)
    writeRaw('auth', value)
  }, [])
  const setUserSettings = useCallback((value: Partial<UserSettings>) => {
    setUserSettingsState((current) => ({ ...current, ...value }))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.lang = locale
    document.documentElement.style.colorScheme = theme
  }, [theme, locale])

  useEffect(() => {
    session.locale = locale
    session.jwt = jwt
    session.userJwt = userJwt
    session.auth = auth
    session.userSettings = userSettings
    session.openSettings = openSettings
    session.showAuth = showAuth
    session.loading = loading
    session.setUserSettings = setUserSettings
    session.setShowAuth = setShowAuth
    session.setLoading = setLoading
  }, [
    locale, jwt, userJwt, auth, userSettings, openSettings,
    showAuth, loading, setUserSettings,
  ])

  const showAdminPage = Boolean(userJwt && userSettings.is_admin)

  const value = useMemo<AppState>(() => ({
    locale, setLocale, theme, toggleTheme,
    jwt, setJwt, userJwt, setUserJwt, auth, setAuth,
    loading, setLoading, showAuth, setShowAuth,
    openSettings, setOpenSettings, userOpenSettings, setUserOpenSettings,
    userSettings, setUserSettings, addressSettings, setAddressSettings,
    addresses, setAddresses, addressesFetched, setAddressesFetched,
    switchingAddress, addressOpenFailed, inboxEpoch, openMailbox,
    finishAddressSwitch, invalidateAddressSwitch, showAdminPage,
  }), [
    locale, setLocale, theme, toggleTheme, jwt, setJwt, userJwt, setUserJwt,
    auth, setAuth, loading, showAuth,
    openSettings, userOpenSettings, userSettings, setUserSettings,
    addressSettings, addresses, addressesFetched, switchingAddress, addressOpenFailed,
    inboxEpoch, openMailbox, finishAddressSwitch, invalidateAddressSwitch, showAdminPage,
  ])

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}

export const useAppState = () => {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used within AppStateProvider')
  return value
}
