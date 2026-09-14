import { useState, type ReactNode } from 'react'
import {
  Envelope,
  Gear,
  Moon,
  Person,
  Sun,
  Tray,
} from '@gravity-ui/icons'
import {
  Avatar,
  Button,
  Input,
  Label,
  Modal,
  TextField,
  Tooltip,
} from '@heroui/react'
import { AppLayout, Sidebar } from '@heroui-pro/react'
import { useLocation, useNavigate } from 'react-router'
import { useAppState } from '../store/app-store'
import { useI18n } from '../i18n'
import { stripLocalePrefix, withLocale } from '../i18n/locale'
import { getInitials, parseSender } from '../utils/mail'

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, locale } = useI18n()
  const {
    theme,
    toggleTheme,
    addressSettings,
    userSettings,
    showAuth,
    setShowAuth,
    auth,
  } = useAppState()
  const currentPath = stripLocalePrefix(location.pathname)
  const identity = addressSettings.address || userSettings.user_email || t('brand')
  const sender = parseSender(identity)

  return (
    <>
      <AppLayout
        navigate={(href) => navigate(href)}
        sidebarCollapsible="offcanvas"
        sidebar={
          <MailSidebar
            currentPath={currentPath}
            identity={identity}
            initials={getInitials(sender.name)}
            theme={theme}
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

function MailSidebar({
  currentPath,
  identity,
  initials,
  theme,
  onToggleTheme,
}: {
  currentPath: string
  identity: string
  initials: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()

  const items = [
    { href: withLocale('/', locale), icon: Tray, id: 'inbox', label: t('inbox'), current: currentPath === '/' || currentPath === '/telegram_mail' },
    { href: withLocale('/user', locale), icon: Person, id: 'account', label: t('account'), current: currentPath === '/user' },
    { href: withLocale('/admin', locale), icon: Gear, id: 'admin', label: t('admin'), current: currentPath === '/admin' },
  ]

  return (
    <>
      <Sidebar>
        <SidebarBody
          identity={identity}
          initials={initials}
          items={items}
          theme={theme}
          onCreate={() => navigate(withLocale('/user', locale))}
          onToggleTheme={onToggleTheme}
        />
      </Sidebar>
      <Sidebar.Mobile>
        <SidebarBody
          idPrefix="mobile-"
          identity={identity}
          initials={initials}
          items={items}
          theme={theme}
          onCreate={() => navigate(withLocale('/user', locale))}
          onToggleTheme={onToggleTheme}
        />
      </Sidebar.Mobile>
    </>
  )
}

function SidebarBody({
  idPrefix = '',
  identity,
  initials,
  items,
  theme,
  onCreate,
  onToggleTheme,
}: {
  idPrefix?: string
  identity: string
  initials: string
  items: { href: string; icon: typeof Tray; id: string; label: string; current: boolean }[]
  theme: 'light' | 'dark'
  onCreate: () => void
  onToggleTheme: () => void
}) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <>
      <Sidebar.Header>
        <div className="flex items-center gap-3 px-1 py-1">
          <Avatar className="size-9">
            <Avatar.Fallback>{initials}</Avatar.Fallback>
          </Avatar>
          <div className="flex min-w-0 flex-col" data-sidebar="label">
            <span className="text-foreground text-sm font-medium leading-tight">{t('you')}</span>
            <span className="text-muted truncate text-xs font-medium leading-tight">{identity}</span>
          </div>
        </div>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.Menu aria-label={t('inbox')}>
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
        <div className="flex flex-col gap-2 px-2 pb-1">
          <Button fullWidth size="sm" onPress={onCreate}>
            <Envelope className="size-4" />
            {t('createAddress')}
          </Button>
          <div className="flex gap-1">
            <Button
              className="flex-1"
              size="sm"
              variant="ghost"
              onPress={() => navigate(withLocale(stripLocalePrefix(location.pathname), locale === 'zh' ? 'en' : 'zh'))}
            >
              {locale === 'zh' ? 'EN' : '中文'}
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
