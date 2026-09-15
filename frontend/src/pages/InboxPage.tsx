import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, toast } from '@heroui/react'
import { Tray } from '@gravity-ui/icons'
import { useNavigate, useSearchParams } from 'react-router'
import { AppLayout } from '@heroui-pro/react'
import { AppShell } from '../components/AppShell'
import { MailDetail, MailEmpty } from '../components/MailDetail'
import { MailList } from '../components/MailList'
import { api } from '../api/client'
import { useAppState } from '../store/app-store'
import type { Mail } from '../store/types'
import { useI18n } from '../i18n'
import { withLocale } from '../i18n/locale'

export function InboxPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { jwt, setJwt, theme, openSettings, setAddressSettings } = useAppState()
  const [mails, setMails] = useState<Mail[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [listLoading, setListLoading] = useState(() => Boolean(jwt))
  const allowRemote = true

  useEffect(() => {
    const jwtQuery = params.get('jwt')
    if (jwtQuery) {
      setJwt(jwtQuery)
      const next = new URLSearchParams(params)
      next.delete('jwt')
      setParams(next, { replace: true })
    }
  }, [params, setJwt, setParams])

  const load = useCallback(async () => {
    if (!jwt) {
      setMails([])
      return
    }
    try {
      const settings = await api.getSettings()
      setAddressSettings(settings)
      const list = await api.listMails(30, 0)
      setMails(list.results || [])
    } catch (error: any) {
      toast(error.message || t('settingsFailed'), { variant: 'danger' })
      return false
    }
  }, [jwt, setAddressSettings, t])

  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (!jwt) {
      setMails([])
      setListLoading(false)
      return
    }
    let cancelled = false
    setListLoading(true)
    void loadRef.current().finally(() => {
      if (!cancelled) setListLoading(false)
    })
    return () => {
      cancelled = true
    }
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

  const current = filtered.find((mail) => String(mail.id) === selectedId) || null
  const currentIndex = current ? filtered.findIndex((mail) => String(mail.id) === selectedId) : -1
  const hasSelection = Boolean(current)

  useEffect(() => {
    if (!current || current.is_unread !== 1 || !openSettings.enableMailReadStatus) return
    current.is_unread = 0
    void api.updateMailReadStatus(current.id, false).catch(() => {
      current.is_unread = 1
    })
  }, [current?.id, openSettings.enableMailReadStatus])

  if (!jwt) {
    return (
      <AppShell>
        <div className="flex h-svh flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-2 pt-4">
            <AppLayout.MenuToggle className="ml-0" />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-16 text-center">
            <div className="bg-surface shadow-surface flex size-12 items-center justify-center rounded-2xl">
              <Tray className="text-muted size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-foreground text-base font-semibold">{t('noAddressTitle')}</h1>
              <p className="text-muted max-w-[320px] text-sm">{t('noAddressDescription')}</p>
            </div>
            <Button onPress={() => navigate(withLocale('/user', locale))}>{t('goAccount')}</Button>
          </div>
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
            loading={listLoading}
            mails={filtered}
            query={query}
            selectedId={selectedId}
            onQueryChange={setQuery}
            onRefresh={load}
            onSelect={setSelectedId}
          />
        </div>
        <div
          className={`min-h-0 overflow-hidden ${
            hasSelection ? 'flex flex-1 flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          {current ? (
            <MailDetail
              allowRemote={allowRemote}
              canDelete={openSettings.enableUserDeleteEmail}
              index={Math.max(currentIndex, 0)}
              isDark={theme === 'dark'}
              mail={current}
              total={filtered.length}
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
                const next = filtered[currentIndex + 1]
                if (next) setSelectedId(String(next.id))
              }}
              onPrev={() => {
                const prev = filtered[currentIndex - 1]
                if (prev) setSelectedId(String(prev.id))
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
