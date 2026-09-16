import { useEffect, useState } from 'react'
import { Card, Input, Label, Spinner, Tabs, TextField, toast } from '@heroui/react'
import { EmptyState, ListView } from '@heroui-pro/react'
import { Envelope } from '@gravity-ui/icons'
import { useNavigate } from 'react-router'
import { ActionButton } from '../components/ActionButton'
import { AppShell, PageHeader } from '../components/AppShell'
import { CreateAddressForm } from '../components/CreateAddressForm'
import { PageEnter } from '../components/PageEnter'
import { Turnstile } from '../components/Turnstile'
import { api } from '../api/client'
import { useAppState } from '../store/app-store'
import { useI18n } from '../i18n'
import { withLocale } from '../i18n/locale'
import { copyText, hashPassword } from '../utils/hash'

export function UserPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const {
    userJwt, setUserJwt, setJwt, userOpenSettings, setUserOpenSettings,
    userSettings, setUserSettings, openSettings, addresses, setAddresses, setAddressesFetched,
    openMailbox, invalidateAddressSwitch,
  } = useAppState()
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [cfToken, setCfToken] = useState('')
  const [addressesLoading, setAddressesLoading] = useState(false)

  useEffect(() => {
    void api.getUserOpenSettings()
      .then((res) => setUserOpenSettings({ ...res, fetched: true }))
      .catch((error) => toast(error.message, { variant: 'danger' }))
  }, [setUserOpenSettings])

  const loadAddresses = async () => {
    if (!userJwt) {
      setAddresses([])
      setAddressesFetched(true)
      setAddressesLoading(false)
      return
    }
    setAddressesLoading(true)
    setAddressesFetched(false)
    try {
      const settings = await api.getUserSettings()
      if (settings) setUserSettings({ ...settings, fetched: true })
      const res = await api.listBoundAddresses()
      setAddresses(res.results || [])
    } catch (error: any) {
      toast(error.message, { variant: 'danger' })
    } finally {
      setAddressesFetched(true)
      setAddressesLoading(false)
    }
  }

  useEffect(() => {
    void loadAddresses()
  }, [userJwt])

  const login = async () => {
    if (!email || !password) {
      toast(t('pleaseInput'), { variant: 'danger' })
      return false
    }
    try {
      const res = await api.fetch('/user_api/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password: await hashPassword(password),
          cf_token: cfToken,
        }),
      })
      invalidateAddressSwitch()
      setJwt('')
      setUserJwt(res.jwt)
      navigate(withLocale('/', locale))
    } catch (error: any) {
      toast(error.message || t('loginFailed'), { variant: 'danger' })
      return false
    }
  }

  const register = async () => {
    if (!email || !password) {
      toast(t('pleaseInput'), { variant: 'danger' })
      return false
    }
    if (!code && userOpenSettings.enableMailVerify) {
      toast(t('pleaseInputCode'), { variant: 'danger' })
      return false
    }
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
      return false
    }
  }

  const sendCode = async () => {
    if (!email) {
      toast(t('pleaseInputEmail'), { variant: 'danger' })
      return false
    }
    try {
      await api.fetch('/user_api/verify_code', {
        method: 'POST',
        body: JSON.stringify({ email, cf_token: cfToken }),
      })
      toast(t('sendCode'))
    } catch (error: any) {
      toast(error.message, { variant: 'danger' })
      return false
    }
  }

  return (
    <AppShell>
      <div className="flex h-svh flex-col overflow-hidden">
        <PageHeader title={t('account')} />
        <PageEnter
          className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 overflow-auto px-6 pt-4 pb-10"
          scene={userJwt ? 'app' : 'auth'}
        >
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
                  <ActionButton onPress={login}>{t('signIn')}</ActionButton>
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
                      <ActionButton confirm variant="outline" onPress={sendCode}>{t('sendCode')}</ActionButton>
                    </div>
                  ) : null}
                  <Turnstile value={cfToken} onChange={setCfToken} />
                  <ActionButton confirm onPress={register}>{t('signUp')}</ActionButton>
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
              {addressesLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner color="current" />
                </div>
              ) : addresses.length === 0 ? (
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
                      <ListView.ItemAction
                        className="flex items-center gap-2"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <ActionButton
                          size="sm"
                          variant="secondary"
                          onPress={() => openMailbox({ id: Number(row.id), name: row.name })}
                          onAfter={() => navigate(withLocale('/', locale))}
                        >
                          {t('openInbox')}
                        </ActionButton>
                        <ActionButton
                          confirm
                          size="sm"
                          variant="ghost"
                          onPress={async () => {
                            try {
                              const res = await api.fetch(`/user_api/bind_address_jwt/${row.id}`)
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
                      </ListView.ItemAction>
                    </ListView.Item>
                  )}
                </ListView>
              )}
            </div>
          </>
        )}
        </PageEnter>
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
