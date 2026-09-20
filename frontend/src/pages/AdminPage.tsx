import { useEffect, useState } from 'react'
import { Button, Card, Spinner, Tabs, toast } from '@heroui/react'
import { EmptyState, ListView } from '@heroui-pro/react'
import { Envelope, LockOpen, ShieldExclamation } from '@gravity-ui/icons'
import { useNavigate } from 'react-router'
import { ActionButton } from '../components/ActionButton'
import { AdminUsersPanel } from '../components/AdminUsersPanel'
import { AppShell, PageHeader } from '../components/AppShell'
import { CreateAddressForm } from '../components/CreateAddressForm'
import { PageEnter } from '../components/PageEnter'
import { api } from '../api/client'
import { useAppState } from '../store/app-store'
import type { BoundAddress } from '../store/types'
import { useI18n } from '../i18n'
import { withLocale } from '../i18n/locale'
import { copyText } from '../utils/hash'

type Access = 'checking' | 'anonymous' | 'forbidden' | 'granted'

/**
 * Admin console. Access is decided by the account's role alone: the Worker only honours
 * an access token carrying the admin role, so the page mirrors that with three states —
 * not signed in, signed in without the role, and admin.
 */
export function AdminPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { userJwt, userSettings, showAdminPage } = useAppState()
  const access: Access = !userJwt
    ? 'anonymous'
    : !userSettings.fetched
      ? 'checking'
      : showAdminPage ? 'granted' : 'forbidden'

  return (
    <AppShell>
      <div className="flex h-svh flex-col overflow-hidden">
        <PageHeader title={t('admin')} />
        <PageEnter
          className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 overflow-auto px-6 pt-4 pb-10"
          scene={access === 'granted' ? 'app' : 'login'}
        >
          {access === 'checking' ? (
            <div className="flex justify-center py-16">
              <Spinner color="current" />
            </div>
          ) : access === 'anonymous' ? (
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Media variant="icon"><LockOpen /></EmptyState.Media>
                <EmptyState.Title>{t('adminSignInTitle')}</EmptyState.Title>
                <EmptyState.Description>{t('adminSignInHint')}</EmptyState.Description>
              </EmptyState.Header>
              <EmptyState.Content>
                <Button onPress={() => navigate(withLocale('/user', locale))}>{t('goAccount')}</Button>
              </EmptyState.Content>
            </EmptyState>
          ) : access === 'forbidden' ? (
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Media variant="icon"><ShieldExclamation /></EmptyState.Media>
                <EmptyState.Title>{t('adminForbiddenTitle')}</EmptyState.Title>
                <EmptyState.Description>{t('adminForbiddenHint')}</EmptyState.Description>
              </EmptyState.Header>
              <EmptyState.Content>
                <Button variant="outline" onPress={() => navigate(withLocale('/user', locale))}>{t('account')}</Button>
              </EmptyState.Content>
            </EmptyState>
          ) : (
            <AdminConsole />
          )}
        </PageEnter>
      </div>
    </AppShell>
  )
}

function AdminConsole() {
  const { t } = useI18n()
  const [addresses, setAddresses] = useState<BoundAddress[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [count, setCount] = useState(0)

  const loadAddresses = async (nextOffset = 0) => {
    if (nextOffset === 0) setListLoading(true)
    try {
      const res = await api.fetch(`/admin/address?limit=20&offset=${nextOffset}`)
      setCount(res.count || 0)
      setOffset(nextOffset)
      setAddresses((current) => nextOffset === 0 ? (res.results || []) : [...current, ...(res.results || [])])
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    void loadAddresses(0).catch((error) => toast(error.message, { variant: 'danger' }))
  }, [])

  return (
    <Tabs defaultSelectedKey="create">
      <Tabs.ListContainer>
        <Tabs.List aria-label={t('admin')}>
          <Tabs.Tab id="create">{t('createAddress')}<Tabs.Indicator /></Tabs.Tab>
          <Tabs.Tab id="list">{t('addresses')}<Tabs.Indicator /></Tabs.Tab>
          <Tabs.Tab id="users">{t('users')}<Tabs.Indicator /></Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel className="pt-6" id="create">
        <Card className="w-full">
          <Card.Header>
            <Card.Title>{t('createAddress')}</Card.Title>
          </Card.Header>
          <Card.Content>
            <CreateAddressForm mode="admin" onCreated={() => void loadAddresses(0)} />
          </Card.Content>
        </Card>
      </Tabs.Panel>
      <Tabs.Panel className="pt-6" id="list">
        {listLoading && addresses.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner color="current" />
          </div>
        ) : (
          <>
            <ListView
              aria-label={t('addresses')}
              items={addresses.map((row) => ({ ...row, id: String(row.id) }))}
            >
              {(row) => (
                <ListView.Item id={String(row.id)} textValue={row.name}>
                  <ListView.ItemContent>
                    <Envelope />
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title>{row.name}</ListView.Title>
                      <ListView.Description>
                        {row.mail_count || 0} mail
                      </ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction
                    className="flex items-center gap-2"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <ActionButton
                      confirm
                      size="sm"
                      variant="ghost"
                      onPress={async () => {
                        try {
                          const res = await api.fetch(`/admin/show_password/${row.id}`)
                          await copyText(res.jwt)
                          toast(t('copied'))
                        } catch (error: any) {
                          toast(error.message, { variant: 'danger' })
                          return false
                        }
                      }}
                    >
                      {t('copyJwt')}
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="danger-soft"
                      onPress={async () => {
                        try {
                          await api.fetch(`/admin/delete_address/${row.id}`, { method: 'DELETE' })
                          setAddresses((items) => items.filter((item) => String(item.id) !== String(row.id)))
                        } catch (error: any) {
                          toast(error.message, { variant: 'danger' })
                          return false
                        }
                      }}
                    >
                      {t('delete')}
                    </ActionButton>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
            {addresses.length < count ? (
              <ActionButton className="mt-4" variant="outline" onPress={() => loadAddresses(offset + 20)}>
                {t('loadMore')}
              </ActionButton>
            ) : null}
          </>
        )}
      </Tabs.Panel>
      <Tabs.Panel className="pt-6" id="users">
        <AdminUsersPanel />
      </Tabs.Panel>
    </Tabs>
  )
}
