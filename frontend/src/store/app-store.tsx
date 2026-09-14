import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { session, emptyOpenSettings, emptyUserSettings } from './session'
import type { AddressSettings, OpenSettings, UserOpenSettings, UserSettings } from './types'
import { APP_CONFIG } from '../config'
import {
  DEFAULT_LOCALE,
  getBrowserLocale,
  isSupportedLocale,
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
  adminAuth: string
  setAdminAuth: (value: string) => void
  auth: string
  setAuth: (value: string) => void
  loading: boolean
  setLoading: (value: boolean) => void
  showAuth: boolean
  setShowAuth: (value: boolean) => void
  showAdminAuth: boolean
  setShowAdminAuth: (value: boolean) => void
  openSettings: OpenSettings
  setOpenSettings: (value: OpenSettings) => void
  userOpenSettings: UserOpenSettings
  setUserOpenSettings: (value: UserOpenSettings) => void
  userSettings: UserSettings
  setUserSettings: (value: Partial<UserSettings>) => void
  addressSettings: AddressSettings
  setAddressSettings: (value: AddressSettings) => void
  showAdminPage: boolean
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = readRaw('preferredLocale')
    if (isSupportedLocale(stored)) return stored
    const configured = APP_CONFIG.DEFAULT_LANG
    if (isSupportedLocale(configured)) return configured
    return getBrowserLocale() || DEFAULT_LOCALE
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(readTheme)
  const [jwt, setJwtState] = useState(() => readRaw('jwt'))
  const [userJwt, setUserJwtState] = useState(() => readRaw('userJwt'))
  const [adminAuth, setAdminAuthState] = useState(() => readRaw('adminAuth'))
  const [auth, setAuthState] = useState(() => readRaw('auth'))
  const [loading, setLoading] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showAdminAuth, setShowAdminAuth] = useState(false)
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

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    writeRaw('preferredLocale', next)
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
  const setUserJwt = useCallback((value: string) => {
    setUserJwtState(value)
    writeRaw('userJwt', value)
  }, [])
  const setAdminAuth = useCallback((value: string) => {
    setAdminAuthState(value)
    writeRaw('adminAuth', value)
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
    session.adminAuth = adminAuth
    session.auth = auth
    session.userSettings = userSettings
    session.openSettings = openSettings
    session.showAuth = showAuth
    session.showAdminAuth = showAdminAuth
    session.loading = loading
    session.setUserSettings = setUserSettings
    session.setShowAuth = setShowAuth
    session.setShowAdminAuth = setShowAdminAuth
    session.setLoading = setLoading
  }, [
    locale, jwt, userJwt, adminAuth, auth, userSettings, openSettings,
    showAuth, showAdminAuth, loading, setUserSettings,
  ])

  const showAdminPage = Boolean(
    adminAuth || userSettings.is_admin || openSettings.disableAdminPasswordCheck,
  )

  const value = useMemo<AppState>(() => ({
    locale, setLocale, theme, toggleTheme,
    jwt, setJwt, userJwt, setUserJwt, adminAuth, setAdminAuth, auth, setAuth,
    loading, setLoading, showAuth, setShowAuth, showAdminAuth, setShowAdminAuth,
    openSettings, setOpenSettings, userOpenSettings, setUserOpenSettings,
    userSettings, setUserSettings, addressSettings, setAddressSettings, showAdminPage,
  }), [
    locale, setLocale, theme, toggleTheme, jwt, setJwt, userJwt, setUserJwt,
    adminAuth, setAdminAuth, auth, setAuth, loading, showAuth, showAdminAuth,
    openSettings, userOpenSettings, userSettings, setUserSettings, addressSettings, showAdminPage,
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
