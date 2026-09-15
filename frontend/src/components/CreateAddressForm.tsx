import { useState } from 'react'
import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
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

export function CreateAddressForm({
  mode,
  onCreated,
}: {
  mode: 'user' | 'admin'
  onCreated?: (created: Created) => void
}) {
  const { t } = useI18n()
  const { openSettings, setJwt } = useAppState()
  const [name, setName] = useState('')
  const [domain, setDomain] = useState(openSettings.domains[0]?.value || '')
  const [cfToken, setCfToken] = useState('')
  const [created, setCreated] = useState<Created | null>(null)

  const submit = async () => {
    const selectedDomain = domain || openSettings.domains[0]?.value || ''
    const localPart = name.trim() || randomLocalPart(12)
    if (!selectedDomain) {
      toast(t('fillFields'), { variant: 'danger' })
      return false
    }
    const path = mode === 'admin' ? '/admin/new_address' : '/api/new_address'
    const body = mode === 'admin'
      ? {
          enablePrefix: Boolean(openSettings.prefix),
          enableRandomSubdomain: false,
          name: localPart,
          domain: selectedDomain,
        }
      : {
          name: localPart,
          domain: selectedDomain,
          cf_token: cfToken,
          enableRandomSubdomain: false,
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
        selectedKey={domain || openSettings.domains[0]?.value}
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
