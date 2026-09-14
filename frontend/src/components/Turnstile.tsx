import { useEffect, useId, useState } from 'react'
import { Button, Spinner } from '@heroui/react'
import { useAppState } from '../store/app-store'
import { useI18n } from '../i18n'

export function Turnstile({
  value,
  onChange,
}: {
  value: string
  onChange: (token: string) => void
}) {
  const { openSettings, theme, locale } = useAppState()
  const { t } = useI18n()
  const reactId = useId().replace(/:/g, '')
  const containerId = `cf-turnstile-${reactId}`
  const [widgetId, setWidgetId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!openSettings.cfTurnstileSiteKey) return
    let cancelled = false
    const render = async () => {
      setLoading(true)
      onChange('')
      for (let i = 0; i < 80 && !window.turnstile; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      const container = document.getElementById(containerId)
      if (cancelled || !window.turnstile || !container) {
        setLoading(false)
        return
      }
      if (widgetId) window.turnstile.remove(widgetId)
      const id = window.turnstile.render(`#${containerId}`, {
        sitekey: openSettings.cfTurnstileSiteKey,
        language: locale === 'zh' ? 'zh-CN' : 'en',
        theme,
        callback: (token: string) => onChange(token),
      })
      if (!cancelled) setWidgetId(id)
      setLoading(false)
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [openSettings.cfTurnstileSiteKey, locale, theme, containerId])

  if (!openSettings.cfTurnstileSiteKey) return null

  return (
    <div className="flex flex-col gap-2">
      {loading ? <Spinner size="sm" /> : null}
      <div id={containerId} />
      <Button size="sm" variant="ghost" onPress={() => onChange('')}>
        {t('refresh')}
      </Button>
      <input type="hidden" value={value} readOnly />
    </div>
  )
}
