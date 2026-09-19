import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toast } from '@heroui/react'
import { AppStateProvider, useAppState } from './store/app-store'
import { I18nProvider } from './i18n'
import { api } from './api/client'
import { APP_CONFIG } from './config'
import { InboxPage } from './pages/InboxPage'
import { UserPage } from './pages/UserPage'
import { AdminPage } from './pages/AdminPage'
import './styles.css'

function LocaleGate({ children }: { children: React.ReactNode }) {
  const { locale } = useAppState()
  return <I18nProvider locale={locale}>{children}</I18nProvider>
}

function Bootstrap() {
  const {
    setOpenSettings, setUserSettings, userJwt, jwt, setAddresses, setAddressesFetched, addresses, openMailbox,
    openSettings,
  } = useAppState()

  useEffect(() => {
    void api.getOpenSettings(setOpenSettings)
  }, [setOpenSettings])

  // Worker 的 TITLE 是站点名的来源；index.html 里的标题只是它到达前的占位。
  useEffect(() => {
    if (openSettings.title) document.title = openSettings.title
  }, [openSettings.title])

  useEffect(() => {
    if (!userJwt) {
      setAddresses([])
      setAddressesFetched(true)
      return
    }
    setAddressesFetched(false)
    void api.getUserSettings()
      .then((settings) => {
        if (settings) setUserSettings({ ...settings, fetched: true })
      })
      .catch(() => {})
    let cancelled = false
    void api.listBoundAddresses()
      .then((res) => {
        if (!cancelled) setAddresses(res.results || [])
      })
      .catch(() => {
        if (!cancelled) setAddresses([])
      })
      .finally(() => {
        if (!cancelled) setAddressesFetched(true)
      })
    return () => {
      cancelled = true
    }
  }, [userJwt, setUserSettings, setAddresses, setAddressesFetched])

  useEffect(() => {
    if (!userJwt || jwt || addresses.length === 0) return
    void openMailbox(addresses[0])
  }, [userJwt, jwt, addresses, openMailbox])

  useEffect(() => {
    const token = APP_CONFIG.CF_WEB_ANALY_TOKEN
    if (!token) return
    if (document.querySelector('script[src="https://static.cloudflareinsights.com/beacon.min.js"]')) return
    const script = document.createElement('script')
    script.defer = true
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
    script.dataset.cfBeacon = `{ token: ${token} }`
    document.body.appendChild(script)
  }, [])

  return null
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<InboxPage />} />
      <Route path="/user" element={<UserPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/telegram_mail" element={<InboxPage />} />
      <Route path="/en" element={<Navigate replace to="/" />} />
      <Route path="/zh" element={<Navigate replace to="/" />} />
      <Route path="/en/user" element={<Navigate replace to="/user" />} />
      <Route path="/zh/user" element={<Navigate replace to="/user" />} />
      <Route path="/en/admin" element={<Navigate replace to="/admin" />} />
      <Route path="/zh/admin" element={<Navigate replace to="/admin" />} />
      <Route path="/en/telegram_mail" element={<Navigate replace to="/telegram_mail" />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

export function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <LocaleGate>
          <Bootstrap />
          <Toast.Provider />
          <AppRoutes />
        </LocaleGate>
      </BrowserRouter>
    </AppStateProvider>
  )
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
