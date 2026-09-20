import { useState, type ReactNode } from 'react'
import {
  Envelope,
  Gear,
  Moon,
  Person,
  Sun,
  Tray,
} from '@gravity-ui/icons'
import { Avatar, Button, Input, Label, Modal, TextField, Tooltip } from '@heroui/react'
import { AppLayout, Sidebar } from '@heroui-pro/react'
import { useLocation, useNavigate } from 'react-router'
import { useAppState } from '../store/app-store'
import type { BoundAddress } from '../store/types'
import { useI18n } from '../i18n'
import { stripLocalePrefix, withLocale } from '../i18n/locale'
import { getInitials } from '../utils/mail'

/** What the sidebar identity card shows: who you are (name) plus a role/status caption. */
type SidebarIdentity = {
  name: string
  caption: string
  /** Initials for the avatar fallback; empty means "show the brand mark". */
  initials: string
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, locale } = useI18n()
  const {
    theme,
    toggleTheme,
    addressSettings,
    userSettings,
    openSettings,
    userJwt,
    addresses,
    switchingAddress,
    openMailbox,
    showAuth,
    setShowAuth,
    auth,
    showAdminPage,
  } = useAppState()
  const currentPath = stripLocalePrefix(location.pathname)
  const identity = resolveIdentity({
    userEmail: userSettings.user_email,
    isAdmin: userSettings.is_admin,
    address: addressSettings.address,
    siteTitle: openSettings.title || t('brand'),
    t,
  })

  return (
    <>
      <AppLayout
        navigate={(href) => navigate(href)}
        sidebarCollapsible="offcanvas"
        sidebar={
          <MailSidebar
            addresses={addresses}
            currentAddress={switchingAddress || addressSettings.address}
            currentPath={currentPath}
            identity={identity}
            isAdmin={showAdminPage}
            signedIn={Boolean(userJwt)}
            theme={theme}
            onOpenMailbox={(id) => {
              const selected = addresses.find((row) => row.id === id)
              if (!selected) return
              if (selected.name === addressSettings.address && currentPath === '/' && !switchingAddress) return
              void openMailbox(selected)
            }}
            onToggleTheme={toggleTheme}
          />
        }
      >
        {children}
      </AppLayout>
      <SitePasswordModal isOpen={showAuth && !auth} onOpenChange={setShowAuth} />
    </>
  )
}

/**
 * Header identity follows the HeroUI Pro templates: line 1 is who you are,
 * line 2 is the role/status. Priority: account → anonymous mailbox → brand.
 */
function resolveIdentity({
  userEmail,
  isAdmin,
  address,
  siteTitle,
  t,
}: {
  userEmail: string
  isAdmin: boolean
  address: string
  siteTitle: string
  t: (key: 'roleAdmin' | 'roleSignedIn' | 'roleTempMailbox' | 'roleGuest') => string
}): SidebarIdentity {
  if (userEmail) {
    return {
      name: userEmail,
      caption: isAdmin ? t('roleAdmin') : t('roleSignedIn'),
      initials: getInitials(userEmail.split('@')[0]),
    }
  }
  if (address) {
    return {
      name: address,
      caption: t('roleTempMailbox'),
      initials: getInitials(address.split('@')[0]),
    }
  }
  return { name: siteTitle, caption: t('roleGuest'), initials: '' }
}

function MailSidebar({
  currentPath,
  currentAddress,
  identity,
  addresses,
  isAdmin,
  signedIn,
  theme,
  onOpenMailbox,
  onToggleTheme,
}: {
  currentPath: string
  currentAddress: string
  identity: SidebarIdentity
  addresses: BoundAddress[]
  isAdmin: boolean
  signedIn: boolean
  theme: 'light' | 'dark'
  onOpenMailbox: (id: number) => void
  onToggleTheme: () => void
}) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const inInbox = currentPath === '/' || currentPath === '/telegram_mail'
  const items = [
    ...(signedIn ? [] : [{ href: withLocale('/', locale), icon: Tray, id: 'inbox', label: t('inbox'), current: inInbox }]),
    { href: withLocale('/user', locale), icon: Person, id: 'account', label: t('account'), current: currentPath === '/user' },
    // Admin console is role-gated; only render the entry when the account holds the admin role.
    ...(isAdmin ? [{ href: withLocale('/admin', locale), icon: Gear, id: 'admin', label: t('admin'), current: currentPath === '/admin' }] : []),
  ]

  return (
    <>
      <Sidebar>
        <SidebarBody
          addresses={addresses}
          currentAddress={currentAddress}
          identity={identity}
          inInbox={inInbox}
          items={items}
          signedIn={signedIn}
          theme={theme}
          onCreate={() => navigate(withLocale('/user', locale))}
          onOpenMailbox={onOpenMailbox}
          onToggleTheme={onToggleTheme}
        />
      </Sidebar>
      <Sidebar.Mobile>
        <SidebarBody
          idPrefix="mobile-"
          addresses={addresses}
          currentAddress={currentAddress}
          identity={identity}
          inInbox={inInbox}
          items={items}
          signedIn={signedIn}
          theme={theme}
          onCreate={() => navigate(withLocale('/user', locale))}
          onOpenMailbox={onOpenMailbox}
          onToggleTheme={onToggleTheme}
        />
      </Sidebar.Mobile>
    </>
  )
}

function SidebarBody({
  idPrefix = '',
  identity,
  items,
  addresses,
  currentAddress,
  inInbox,
  signedIn,
  theme,
  onCreate,
  onOpenMailbox,
  onToggleTheme,
}: {
  idPrefix?: string
  identity: SidebarIdentity
  items: { href: string; icon: typeof Tray; id: string; label: string; current: boolean }[]
  addresses: BoundAddress[]
  currentAddress: string
  inInbox: boolean
  signedIn: boolean
  theme: 'light' | 'dark'
  onCreate: () => void
  onOpenMailbox: (id: number) => void
  onToggleTheme: () => void
}) {
  const { t, locale } = useI18n()

  return (
    <>
      <Sidebar.Header>
        <div className="flex items-center gap-3 px-1 py-1">
          <Avatar className="size-9 shrink-0" color="default" variant="soft">
            <Avatar.Fallback>
              {identity.initials || <Envelope className="size-4" />}
            </Avatar.Fallback>
          </Avatar>
          <div className="flex min-w-0 flex-col" data-sidebar="label">
            <span className="text-foreground truncate text-sm font-medium leading-tight" title={identity.name}>
              {identity.name}
            </span>
            <span className="text-muted truncate text-xs font-medium leading-tight">{identity.caption}</span>
          </div>
        </div>
      </Sidebar.Header>
      <Sidebar.Content>
        {signedIn ? (
          <Sidebar.Group>
            <Sidebar.GroupLabel>{t('mailboxes')}</Sidebar.GroupLabel>
            <Sidebar.Menu aria-label={t('mailboxes')}>
              {addresses.map((row) => (
                <Sidebar.MenuItem
                  key={row.id}
                  href={withLocale('/', locale)}
                  id={`${idPrefix}mailbox-${row.id}`}
                  isCurrent={inInbox && currentAddress === row.name}
                  textValue={row.name}
                  onAction={() => onOpenMailbox(row.id)}
                >
                  <Sidebar.MenuIcon>
                    <Envelope className="size-4" />
                  </Sidebar.MenuIcon>
                  <Sidebar.MenuLabel>{row.name}</Sidebar.MenuLabel>
                  {row.mail_count ? <Sidebar.MenuChip>{row.mail_count}</Sidebar.MenuChip> : null}
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        ) : null}
        <Sidebar.Group>
          <Sidebar.Menu aria-label={t('account')}>
            {items.map((item) => (
              <Sidebar.MenuItem
                key={item.id}
                href={item.href}
                id={`${idPrefix}${item.id}`}
                isCurrent={item.current}
                textValue={item.label}
              >
                <Sidebar.MenuIcon>
                  <item.icon className="size-4" />
                </Sidebar.MenuIcon>
                <Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
              </Sidebar.MenuItem>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Footer>
        <div className="flex items-center gap-1 px-2 pb-1">
          <Button className="flex-1" size="sm" onPress={onCreate}>
            <Envelope className="size-4" />
            {t('createAddress')}
          </Button>
          <Tooltip>
            <Tooltip.Trigger>
              <Button isIconOnly aria-label={theme === 'dark' ? t('light') : t('dark')} size="sm" variant="ghost" onPress={onToggleTheme}>
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>{theme === 'dark' ? t('light') : t('dark')}</Tooltip.Content>
          </Tooltip>
        </div>
      </Sidebar.Footer>
    </>
  )
}

export function PageHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-2 pt-4">
      <AppLayout.MenuToggle className="ml-0" />
      <h1 className="text-foreground text-base font-semibold">{title}</h1>
    </div>
  )
}

function SitePasswordModal({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n()
  const { setAuth } = useAppState()
  const [password, setPassword] = useState('')

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.Header>
              <Modal.Heading>{t('sitePassword')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <p className="text-muted text-sm">{t('sitePasswordHint')}</p>
              <TextField
                className="w-full"
                type="password"
                value={password}
                onChange={setPassword}
                variant="secondary"
              >
                <Label>{t('password')}</Label>
                <Input />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button
                onPress={() => {
                  setAuth(password)
                  onOpenChange(false)
                }}
              >
                {t('continue')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
