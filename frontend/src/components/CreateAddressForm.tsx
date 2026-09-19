import { useState } from 'react'
import {
  Button,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Radio,
  RadioGroup,
  Select,
  TextField,
  toast,
} from '@heroui/react'
import { api } from '../api/client'
import { useAppState } from '../store/app-store'
import { useI18n } from '../i18n'
import { copyText, randomLocalPart } from '../utils/hash'
import { ActionButton } from './ActionButton'
import { Turnstile } from './Turnstile'

type Created = {
  address: string
  jwt: string
  password?: string
}

type SubdomainMode = 'none' | 'random' | 'custom'

const SUBDOMAIN_MODES = [
  { value: 'none', label: 'subdomainNone' },
  { value: 'random', label: 'subdomainRandom' },
  { value: 'custom', label: 'subdomainCustom' },
] as const

export function CreateAddressForm({
  mode,
  onCreated,
}: {
  mode: 'user' | 'admin'
  onCreated?: (created: Created) => void
}) {
  const { t } = useI18n()
  const { openSettings, setJwt, invalidateAddressSwitch } = useAppState()
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [subdomainMode, setSubdomainMode] = useState<SubdomainMode>('none')
  const [subdomain, setSubdomain] = useState('')
  const [cfToken, setCfToken] = useState('')
  const [created, setCreated] = useState<Created | null>(null)

  const selectedDomain = domain || openSettings.domains[0]?.value || ''
  // 后端只对 RANDOM_SUBDOMAIN_DOMAINS 里的基础域名放行随机和自定义子域名。
  const allowSubdomain = openSettings.randomSubdomainDomains.includes(selectedDomain)
  const activeMode = allowSubdomain ? subdomainMode : 'none'
  const subdomainPrefix = subdomain.trim().toLowerCase()

  const submit = async () => {
    const localPart = name.trim() || randomLocalPart(12)
    if (!selectedDomain) {
      toast(t('fillFields'), { variant: 'danger' })
      return false
    }
    if (activeMode === 'custom' && !subdomainPrefix) {
      toast(t('fillSubdomain'), { variant: 'danger' })
      return false
    }
    const path = mode === 'admin' ? '/admin/new_address' : '/api/new_address'
    const body = {
      name: localPart,
      domain: activeMode === 'custom' ? `${subdomainPrefix}.${selectedDomain}` : selectedDomain,
      enableRandomSubdomain: activeMode === 'random',
      ...(mode === 'admin'
        ? { enablePrefix: Boolean(openSettings.prefix) }
        : { cf_token: cfToken }),
    }
    try {
      const res = await api.fetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const next = {
        address: res.address || '',
        jwt: res.jwt || '',
        password: res.password || '',
      }
      setCreated(next)
      if (mode === 'user' && next.jwt) {
        invalidateAddressSwitch()
        setJwt(next.jwt)
        try {
          await api.bindUserAddress()
        } catch {
          // bind is best-effort when the user session exists
        }
      }
      toast(t('created'), { variant: 'success' })
      onCreated?.(next)
    } catch (error: any) {
      toast(error.message || t('registerFailed'), { variant: 'danger' })
      return false
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TextField
        className="w-full"
        name="addressName"
        value={name}
        onChange={setName}
        variant="secondary"
      >
        <Label>{t('addressName')}</Label>
        <Input placeholder="alice" />
      </TextField>
      <Select
        className="w-full"
        placeholder={t('domain')}
        selectedKey={selectedDomain}
        onSelectionChange={(key) => setDomain(String(key))}
      >
        <Label>{t('domain')}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {openSettings.domains.map((item) => (
              <ListBox.Item key={item.value} id={item.value} textValue={item.label}>
                {item.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      {allowSubdomain ? (
        <RadioGroup
          orientation="horizontal"
          value={subdomainMode}
          onChange={(value) => setSubdomainMode(value as SubdomainMode)}
        >
          <Label>{t('subdomain')}</Label>
          {SUBDOMAIN_MODES.map((item) => (
            <Radio key={item.value} value={item.value}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {t(item.label)}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
      ) : null}
      {activeMode === 'custom' ? (
        <TextField
          className="w-full"
          name="subdomain"
          value={subdomain}
          onChange={setSubdomain}
          variant="secondary"
        >
          <Label>{t('subdomainCustom')}</Label>
          <Input placeholder="team" />
          <Description>{`${subdomainPrefix || 'team'}.${selectedDomain}`}</Description>
        </TextField>
      ) : null}
      {mode === 'user' ? <Turnstile value={cfToken} onChange={setCfToken} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onPress={() => setName(randomLocalPart(10))}
        >
          {t('randomName')}
        </Button>
        <ActionButton confirm onPress={submit}>
          {t('create')}
        </ActionButton>
      </div>
      <Modal>
        <Modal.Backdrop isOpen={Boolean(created)} onOpenChange={(open) => !open && setCreated(null)}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-md">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t('addressCredential')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-sm">{created?.address}</p>
                {created?.jwt ? (
                  <ActionButton
                    confirm
                    variant="secondary"
                    onPress={async () => {
                      await copyText(created.jwt)
                      toast(t('copied'))
                    }}
                  >
                    {t('copyJwt')}
                  </ActionButton>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="outline">{t('close')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  )
}
