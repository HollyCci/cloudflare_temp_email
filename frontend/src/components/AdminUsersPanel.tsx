import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  SearchField,
  Select,
  Spinner,
  TextField,
  toast,
} from '@heroui/react'
import { EmptyState, ListView } from '@heroui-pro/react'
import { Persons } from '@gravity-ui/icons'
import { ActionButton } from './ActionButton'
import { api } from '../api/client'
import { useAppState } from '../store/app-store'
import { useI18n } from '../i18n'
import { hashPassword } from '../utils/hash'

const PAGE_SIZE = 20
const NO_ROLE = '__none__'

type AdminUser = {
  id: number
  user_email: string
  role_text: string | null
  address_count?: number
  created_at?: string
}

type RoleOption = { role: string }

/**
 * Admin console → Users. Lists accounts, assigns a role from the configured catalog,
 * creates accounts directly, and deletes them. Role is the only authorization primitive:
 * whoever holds the admin role sees this page.
 */
export function AdminUsersPanel() {
  const { t } = useI18n()
  const { userSettings } = useAppState()
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const adminRole = userSettings.user_role?.role || ''

  const load = useCallback(async (nextOffset: number, search: string) => {
    if (nextOffset === 0) setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) })
      if (search.trim()) params.set('query', search.trim())
      const res = await api.fetch(`/admin/users?${params.toString()}`, { showLoading: false })
      setCount(res.count || 0)
      setOffset(nextOffset)
      setUsers((current) => nextOffset === 0 ? (res.results || []) : [...current, ...(res.results || [])])
    } catch (error: any) {
      toast(error.message, { variant: 'danger' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    api.fetch('/admin/user_roles', { showLoading: false })
      .then((res) => setRoles(Array.isArray(res) ? res : []))
      .catch((error) => toast(error.message, { variant: 'danger' }))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(0, query), query ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [query, load])

  const updateRole = async (user: AdminUser, roleText: string) => {
    try {
      await api.fetch('/admin/user_roles', {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id, role_text: roleText }),
        showLoading: false,
      })
      setUsers((current) => current.map((row) => row.id === user.id ? { ...row, role_text: roleText || null } : row))
      toast(t('roleUpdated'))
    } catch (error: any) {
      toast(error.message, { variant: 'danger' })
    }
  }

  const createUser = async () => {
    if (!email || !password) {
      toast(t('pleaseInput'), { variant: 'danger' })
      return false
    }
    try {
      await api.fetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email, password: await hashPassword(password) }),
      })
      setEmail('')
      setPassword('')
      toast(t('userCreated'))
      await load(0, query)
    } catch (error: any) {
      toast(error.message, { variant: 'danger' })
      return false
    }
  }

  const deleteUser = async (user: AdminUser) => {
    try {
      await api.fetch(`/admin/users/${user.id}`, { method: 'DELETE' })
      setUsers((current) => current.filter((row) => row.id !== user.id))
      setCount((current) => Math.max(0, current - 1))
      toast(t('userDeleted'))
    } catch (error: any) {
      toast(error.message, { variant: 'danger' })
      return false
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full">
        <Card.Header>
          <Card.Title>{t('newUser')}</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <TextField className="w-full" name="new-user-email" type="email" value={email} onChange={setEmail} variant="secondary">
            <Label>{t('email')}</Label>
            <Input autoComplete="off" />
          </TextField>
          <TextField className="w-full" name="new-user-password" type="password" value={password} onChange={setPassword} variant="secondary">
            <Label>{t('password')}</Label>
            <Input autoComplete="new-password" />
          </TextField>
          <ActionButton confirm onPress={createUser}>{t('create')}</ActionButton>
        </Card.Content>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('userList')}</h2>
          <span className="text-muted text-sm tabular-nums">{count}</span>
        </div>
        <SearchField aria-label={t('searchUsers')} name="user-search" value={query} onChange={setQuery}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t('searchUsers')} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {loading && users.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner color="current" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon"><Persons /></EmptyState.Media>
              <EmptyState.Title>{t('emptyUsers')}</EmptyState.Title>
              <EmptyState.Description>{t('emptyUsersHint')}</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        ) : (
          <>
            <ListView aria-label={t('userList')} items={users.map((row) => ({ ...row, id: String(row.id) }))}>
              {(row) => {
                const isSelf = Number(row.id) === userSettings.user_id
                const isAdminRow = Boolean(adminRole) && row.role_text === adminRole
                return (
                  <ListView.Item id={String(row.id)} textValue={row.user_email}>
                    <ListView.ItemContent>
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <ListView.Title className="truncate">{row.user_email}</ListView.Title>
                          {isSelf ? <Chip color="accent" size="sm" variant="soft">{t('currentAccount')}</Chip> : null}
                        </div>
                        <ListView.Description>
                          {row.address_count || 0} {t('addressCount')}
                        </ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction
                      className="flex items-center gap-2"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <Select
                        aria-label={t('role')}
                        className="w-36"
                        isDisabled={isSelf && isAdminRow}
                        selectedKey={row.role_text || NO_ROLE}
                        onSelectionChange={(key) => {
                          const next = String(key) === NO_ROLE ? '' : String(key)
                          if (next === (row.role_text || '')) return
                          void updateRole({ ...row, id: Number(row.id) }, next)
                        }}
                      >
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item id={NO_ROLE} textValue={t('noRole')}>
                              {t('noRole')}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            {roles.map((item) => (
                              <ListBox.Item key={item.role} id={item.role} textValue={item.role}>
                                {item.role}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      <ActionButton
                        isDisabled={isSelf}
                        size="sm"
                        variant="danger-soft"
                        onPress={() => deleteUser({ ...row, id: Number(row.id) })}
                      >
                        {t('delete')}
                      </ActionButton>
                    </ListView.ItemAction>
                  </ListView.Item>
                )
              }}
            </ListView>
            {users.length < count ? (
              <ActionButton className="mt-1" variant="outline" onPress={() => load(offset + PAGE_SIZE, query)}>
                {t('loadMore')}
              </ActionButton>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
