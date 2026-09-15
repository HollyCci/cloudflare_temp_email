import { useEffect, useState } from 'react'
import { Button, Card, Input, Label, Spinner, Tabs, TextField, toast } from '@heroui/react'
import { ListView } from '@heroui-pro/react'
import { Envelope } from '@gravity-ui/icons'
import { ActionButton } from '../components/ActionButton'
import { AppShell, PageHeader } from '../components/AppShell'
import { CreateAddressForm } from '../components/CreateAddressForm'
import { Turnstile } from '../components/Turnstile'
import { api } from '../api/client'
import { useAppState } from '../store/app-store'
import type { BoundAddress } from '../store/types'
import { useI18n } from '../i18n'
import { copyText, hashPassword } from '../utils/hash'

export function AdminPage() {
  const { t } = useI18n()
  const {
    showAdminPage, showAdminAuth, setShowAdminAuth, setAdminAuth, adminAuth,
  } = useAppState()
  const [password, setPassword] = useState('')
  const [cfToken, setCfToken] = useState('')
  const [addresses, setAddresses] = useState<BoundAddress[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [count, setCount] = useState(0)
  const needPassword = !showAdminPage || showAdminAuth

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
    if (needPassword) return
    void loadAddresses(0).catch((error) => toast(error.message, { variant: 'danger' }))
  }, [needPassword])

  const login = async () => {
    try {
      await api.fetch('/open_api/admin_login', {
        method: 'POST',
        body: JSON.stringify({
          password: await hashPassword(password),
          cf_token: cfToken,
        }),
      })
      setAdminAuth(password)
      setShowAdminAuth(false)
    } catch (error: any) {
      toast(error.message, { variant: 'danger' })
      return false
    }
  }

  return (
    <AppShell>
      <div className="flex h-svh flex-col overflow-hidden">
        <PageHeader title={t('admin')} />
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 overflow-auto px-6 pt-4 pb-10">
        {needPassword ? (
          <Card className="w-full">
            <Card.Header>
              <Card.Title>{t('adminLogin')}</Card.Title>
              <Card.Description>{t('adminHint')}</Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
              <TextField
                className="w-full"
                type="password"
                value={password}
                onChange={setPassword}
                variant="secondary"
              >
                <Label>{t('adminPassword')}</Label>
                <Input />
              </TextField>
              <Turnstile value={cfToken} onChange={setCfToken} />
              <ActionButton onPress={login}>{t('signIn')}</ActionButton>
            </Card.Content>
          </Card>
        ) : (
          <Tabs defaultSelectedKey="create">
            <Tabs.ListContainer>
              <Tabs.List aria-label={t('admin')}>
                <Tabs.Tab id="create">{t('createAddress')}<Tabs.Indicator /></Tabs.Tab>
                <Tabs.Tab id="list">{t('addresses')}<Tabs.Indicator /></Tabs.Tab>
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
          </Tabs>
        )}
        {adminAuth ? (
          <Button
            variant="outline"
            onPress={() => {
              setAdminAuth('')
              toast(t('logoutDone'))
            }}
          >
            {t('logout')}
          </Button>
        ) : null}
        </div>
      </div>
    </AppShell>
  )
}
