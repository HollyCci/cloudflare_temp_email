import { createContext, createElement, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { messages, type MessageKey } from './messages'
import type { Locale } from './locale'

const I18nContext = createContext<{
  locale: Locale
  t: (key: MessageKey) => string
}>({
  locale: 'zh',
  t: (key) => messages.zh[key],
})

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = useCallback(
    (key: MessageKey) => messages[locale][key] || messages.zh[key],
    [locale],
  )
  const value = useMemo(() => ({ locale, t }), [locale, t])
  return createElement(I18nContext.Provider, { value }, children)
}

export const useI18n = () => useContext(I18nContext)
