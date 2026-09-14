import { useEffect, useState } from 'react'
import { Button, Card, Input, Label, Tabs, TextField, toast } from '@heroui/react'
import { EmptyState, ListView } from '@heroui-pro/react'
import { Envelope } from '@gravity-ui/icons'
import { useNavigate } from 'react-router'
import { AppShell, PageHeader } from '../components/AppShell'
import { CreateAddressForm } from '../components/CreateAddressForm'
import { Turnstile } from '../components/Turnstile'
import { api } from '../api/client'
import { useAppState } from '../store/app-store'
import type { BoundAddress } from '../store/types'
import { useI18n } from '../i18n'
import { withLocale } from '../i18n/locale'
import { copyText, hashPassword } from '../utils/hash'

export function UserPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const {
    userJwt, setUserJwt, setJwt, userOpenSettings, setUserOpenSettings,
    userSettings, setUserSettings, openSettings,
  } = useAppState()
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [cfToken, setCfToken] = useState('')
  const [pending, setPending] = useState(false)
  const [addresses, setAddresses] = useState<BoundAddress[]>([])

  useEffect(() => {
    void api.getUserOpenSettings()
      .then((res) => setUserOpenSettings({ ...res, fetched: true }))
      .catch((error) => toast(error.message, { variant: 'danger' }))
  }, [setUserOpenSettings])

  const loadAddresses = async () => {
    if (!userJwt) {
      setAddresses([])
      return
    }
    try {
      const settings = await api.getUserSettings()
      if (settings) setUserSettings({ ...settings, fetched: true })
      const res = await api.fetch('/user_api/bind_address?limit=50&offset=0')
      setAddresses(res.results || [])
    } catch (error: any) {
      toast(error.message, { variant: 'danger' })
    }
  }

  useEffect(() => {
    void loadAddresses()
  }, [userJwt])

  const login = async () => {
    if (!email || !password) {
      toast(t('pleaseInput'), { variant: 'danger' })
      return
    }
    setPending(true)
    try {
      const res = await api.fetch('/user_api/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password: await hashPassword(password),
          cf_token: cfToken,
        }),
      })
      setUserJwt(res.jwt)
    } catch (error: any) {
      toast(error.message || t('loginFailed'), { variant: 'danger' })
    } finally {
      setPending(false)
    }
  }

  const register = async () => {
    if (!email || !password) {
      toast(t('pleaseInput'), { variant: 'danger' })
      return
    }
    if (!code && userOpenSettings.enableMailVerify) {
      toast(t('pleaseInputCode'), { variant: 'danger' })
      return
    }
    setPending(true)
    try {
      await api.fetch('/user_api/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password: await hashPassword(password),
          code,
          cf_token: cfToken,
        }),
      })
      toast(t('pleaseLogin'))
      setTab('signin')
    } catch (error: any) {
      toast(error.message || t('registerFailed'), { variant: 'danger' })
    } finally {
      setPending(false)
    }
  }

  const sendCode = async () => {
    if (!email) {
      toast(t('pleaseInputEmail'), { variant: 'danger' })
      return
    }
    try {
      await api.fetch('/user_api/verify_code', {
        method: 'POST',
        body: JSON.stringify({ email, cf_token: cfToken }),
      })
      toast(t('sendCode'))
    } catch (error: any) {
      toast(error.message, { variant: 'danger' })
    }
  }

  const openAddress = async (addressId: number) => {
    try {
      const res = await api.fetch(`/user_api/bind_address_jwt/${addressId}`)
      setJwt(res.jwt)
      navigate(withLocale('/', locale))
    } catch (error: any) {
      toast(error.message, { variant: 'danger' })
    }
  }

  return (
    <AppShell>
      <div className="flex h-svh flex-col overflow-hidden">
        <PageHeader title={t('account')} />
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 overflow-auto px-6 pt-4 pb-10">
        {!userJwt ? (
          <Card className="w-full">
            <Card.Header>
              <Card.Title>{t('account')}</Card.Title>
              <Card.Description>{t('noAddressDescription')}</Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
              <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
                <Tabs.ListContainer>
                  <Tabs.List aria-label={t('account')}>
                    <Tabs.Tab id="signin">{t('signIn')}<Tabs.Indicator /></Tabs.Tab>
                    <Tabs.Tab id="signup">{t('signUp')}<Tabs.Indicator /></Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
                <Tabs.Panel className="flex flex-col gap-4 pt-4" id="signin">
                  <AuthFields
                    email={email}
                    password={password}
                    setEmail={setEmail}
                    setPassword={setPassword}
                  />
                  <Turnstile value={cfToken} onChange={setCfToken} />
                  <Button isPending={pending} onPress={() => void login()}>{t('signIn')}</Button>
                </Tabs.Panel>
                <Tabs.Panel className="flex flex-col gap-4 pt-4" id="signup">
                  <AuthFields
                    email={email}
                    password={password}
                    setEmail={setEmail}
                    setPassword={setPassword}
                  />
                  {userOpenSettings.enableMailVerify ? (
                    <div className="flex flex-col gap-2">
                      <TextField className="w-full" value={code} onChange={setCode} variant="secondary">
                        <Label>{t('verifyCode')}</Label>
                        <Input />
                      </TextField>
                      <Button variant="outline" onPress={() => void sendCode()}>{t('sendCode')}</Button>
                    </div>
                  ) : null}
                  <Turnstile value={cfToken} onChange={setCfToken} />
                  <Button isPending={pending} onPress={() => void register()}>{t('signUp')}</Button>
                </Tabs.Panel>
              </Tabs>
            </Card.Content>
          </Card>
        ) : (
          <>
            <div>
              <p className="text-muted text-sm">{t('userEmail')}</p>
              <h1 className="text-foreground text-2xl font-semibold">{userSettings.user_email || '—'}</h1>
            </div>
            {openSettings.enableUserCreateEmail ? (
              <Card className="w-full">
                <Card.Header>
                  <Card.Title>{t('createAddress')}</Card.Title>
                </Card.Header>
                <Card.Content>
                  <CreateAddressForm mode="user" onCreated={() => void loadAddresses()} />
                </Card.Content>
              </Card>
            ) : null}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{t('boundAddresses')}</h2>
              {addresses.length === 0 ? (
                <EmptyState>
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon"><Envelope /></EmptyState.Media>
                    <EmptyState.Title>{t('emptyAddresses')}</EmptyState.Title>
                  </EmptyState.Header>
                </EmptyState>
              ) : (
                <ListView aria-label={t('boundAddresses')} items={addresses.map((row) => ({ ...row, id: String(row.id) }))}>
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
                      <Button size="sm" variant="secondary" onPress={() => void openAddress(Number(row.id))}>
                        {t('openInbox')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={async () => {
                          try {
                            const res = await api.fetch(`/user_api/bind_address_jwt/${row.id}`)
                            await copyText(res.jwt)
                            toast(t('copied'))
                          } catch (error: any) {
                            toast(error.message, { variant: 'danger' })
                          }
                        }}
                      >
                        {t('copyJwt')}
                      </Button>
                    </ListView.Item>
                  )}
                </ListView>
              )}
            </div>
          </>
        )}
      </div>
      </div>
    </AppShell>
  )
}

function AuthFields({
  email,
  password,
  setEmail,
  setPassword,
}: {
  email: string
  password: string
  setEmail: (value: string) => void
  setPassword: (value: string) => void
}) {
  const { t } = useI18n()
  return (
    <>
      <TextField className="w-full" name="email" type="email" value={email} onChange={setEmail} variant="secondary">
        <Label>{t('email')}</Label>
        <Input />
      </TextField>
      <TextField className="w-full" name="password" type="password" value={password} onChange={setPassword} variant="secondary">
        <Label>{t('password')}</Label>
        <Input />
      </TextField>
    </>
  )
}
