import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Spinner, toast } from '@heroui/react'
import { Tray } from '@gravity-ui/icons'
import { useNavigate, useSearchParams } from 'react-router'
import { AppLayout } from '@heroui-pro/react'
import { AppShell } from '../components/AppShell'
import { MailDetail, MailEmpty } from '../components/MailDetail'
import { PageEnter } from '../components/PageEnter'
import { MailList } from '../components/MailList'
import { api } from '../api/client'
import { useAppState } from '../store/app-store'
import type { Mail } from '../store/types'
import { useI18n } from '../i18n'
import { withLocale } from '../i18n/locale'
import { shouldApplyMailLoad } from '../store/mailbox-switch'
import { useGhostClickGuard } from '../hooks/use-ghost-click-guard'

export function InboxPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const {
    jwt, setJwt, theme, openSettings, setAddressSettings, userJwt, addresses, addressesFetched,
    switchingAddress, addressOpenFailed, inboxEpoch, openMailbox, finishAddressSwitch, invalidateAddressSwitch,
  } = useAppState()
  const [mails, setMails] = useState<Mail[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [listLoading, setListLoading] = useState(() => Boolean(jwt))
  // Latest values for in-flight loads to compare against (they outlive the render that started them).
  const latest = useRef({ jwt, switchingAddress })
  latest.current = { jwt, switchingAddress }
  const armGhostClickGuard = useGhostClickGuard()

  useEffect(() => {
    const jwtQuery = params.get('jwt')
    if (jwtQuery) {
      invalidateAddressSwitch()
      setJwt(jwtQuery)
      const next = new URLSearchParams(params)
      next.delete('jwt')
      setParams(next, { replace: true })
    }
  }, [params, setJwt, setParams, invalidateAddressSwitch])

  const load = useCallback(async () => {
    const requestJwt = jwt
    if (!requestJwt) {
      setMails([])
      return
    }
    try {
      const settings = await api.getSettings()
      const list = await api.listMails(30, 0)
      if (!shouldApplyMailLoad({
        requestJwt,
        currentJwt: latest.current.jwt,
        switchingAddress: latest.current.switchingAddress,
        settingsAddress: settings.address || '',
      })) return
      setAddressSettings(settings)
      setMails(list.results || [])
      finishAddressSwitch(settings.address)
    } catch (error: any) {
      if (requestJwt !== latest.current.jwt) return false
      toast(error.message || t('settingsFailed'), { variant: 'danger' })
      finishAddressSwitch(latest.current.switchingAddress)
      return false
    }
  }, [jwt, setAddressSettings, finishAddressSwitch, t])

  const loadRef = useRef(load)
  loadRef.current = load

  // `inboxEpoch` is bumped when a mailbox JWT is applied, so re-opening the
  // same mailbox (e.g. after a failed load) reloads even though `jwt` is unchanged.
  useEffect(() => {
    if (!jwt) {
      setMails([])
      setListLoading(false)
      return
    }
    let cancelled = false
    // The previous list belongs to another JWT; never show it under this one if the load fails.
    setMails([])
    setListLoading(true)
    void loadRef.current().finally(() => {
      if (!cancelled) setListLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [jwt, inboxEpoch])

  useEffect(() => {
    setSelectedId('')
  }, [jwt])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return mails
    return mails.filter((mail) =>
      [mail.subject, mail.text, mail.html, mail.sender, mail.source]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(keyword)),
    )
  }, [mails, query])

  // While a switch is in flight the list is blank and busy; if the switch fails
  // (`switchingAddress` clears, `jwt` unchanged) the old list and selection come back.
  const listBusy = listLoading || Boolean(switchingAddress)
  const visibleMails = switchingAddress ? [] : filtered
  const current = visibleMails.find((mail) => String(mail.id) === selectedId) || null
  const currentIndex = current ? visibleMails.findIndex((mail) => String(mail.id) === selectedId) : -1
  const hasSelection = Boolean(current)

  useEffect(() => {
    if (!current || current.is_unread !== 1 || !openSettings.enableMailReadStatus) return
    current.is_unread = 0
    void api.updateMailReadStatus(current.id, false).catch(() => {
      current.is_unread = 1
    })
  }, [current?.id, openSettings.enableMailReadStatus])

  if (!jwt) {
    const signedIn = Boolean(userJwt)
    const hasMailboxes = addresses.length > 0
    const opening = signedIn && !addressOpenFailed && (!addressesFetched || hasMailboxes)
    const failed = signedIn && addressOpenFailed && hasMailboxes
    const title = opening ? t('openingMailbox') : failed ? t('openingMailboxFailed') : signedIn ? t('noMailboxTitle') : t('noAddressTitle')
    const description = opening
      ? t('openingMailboxHint')
      : failed
        ? t('openingMailboxFailedHint')
        : signedIn
          ? t('noMailboxDescription')
          : t('noAddressDescription')
    const retryOpen = () => {
      const first = addresses[0]
      if (first) void openMailbox(first)
    }
    return (
      <AppShell>
        <div className="flex h-svh flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-2 pt-4">
            <AppLayout.MenuToggle className="ml-0" />
          </div>
          <PageEnter className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-16 text-center">
            <div className="bg-surface shadow-surface flex size-12 items-center justify-center rounded-2xl">
              {opening ? <Spinner color="current" /> : <Tray className="text-muted size-5" />}
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-foreground text-base font-semibold">{title}</h1>
              <p className="text-muted max-w-[320px] text-sm">{description}</p>
            </div>
            {opening ? null : (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {failed ? <Button onPress={retryOpen}>{t('retryOpenMailbox')}</Button> : null}
                <Button variant={failed ? 'outline' : 'primary'} onPress={() => navigate(withLocale('/user', locale))}>
                  {signedIn ? t('createAddress') : t('goAccount')}
                </Button>
              </div>
            )}
          </PageEnter>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex h-svh flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(320px,360px)_1fr]">
        <div
          className={`min-h-0 overflow-hidden ${
            hasSelection ? 'hidden lg:flex lg:flex-col' : 'flex flex-1 flex-col'
          }`}
        >
          <MailList
            loading={listBusy}
            mails={visibleMails}
            query={query}
            selectedId={selectedId}
            onQueryChange={setQuery}
            onRefresh={load}
            onSelect={(id) => {
              setSelectedId(id)
              armGhostClickGuard()
            }}
          />
        </div>
        <div
          className={`min-h-0 overflow-hidden ${
            hasSelection ? 'flex flex-1 flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          {current ? (
            <MailDetail
              key={String(current.id)}
              canDelete={openSettings.enableUserDeleteEmail}
              index={Math.max(currentIndex, 0)}
              isDark={theme === 'dark'}
              mail={current}
              total={visibleMails.length}
              onBack={() => setSelectedId('')}
              onDelete={async () => {
                try {
                  await api.deleteMail(current.id)
                  setMails((items) => items.filter((item) => item.id !== current.id))
                  setSelectedId('')
                } catch (error: any) {
                  toast(error.message, { variant: 'danger' })
                  throw error
                }
              }}
              onNext={() => {
                const next = visibleMails[currentIndex + 1]
                if (!next) return
                setSelectedId(String(next.id))
              }}
              onPrev={() => {
                const prev = visibleMails[currentIndex - 1]
                if (!prev) return
                setSelectedId(String(prev.id))
              }}
            />
          ) : (
            <MailEmpty />
          )}
        </div>
      </div>
    </AppShell>
  )
}
