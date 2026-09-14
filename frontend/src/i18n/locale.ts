export const SUPPORTED_LOCALES = ['zh', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'zh'

export const isSupportedLocale = (value: string | undefined): value is Locale =>
  SUPPORTED_LOCALES.includes(value as Locale)

export const resolveLocaleFromPath = (pathname: string): Locale | null => {
  const first = pathname.split('/').filter(Boolean)[0]
  return isSupportedLocale(first) ? first : null
}

export const stripLocalePrefix = (pathname: string) => {
  const locale = resolveLocaleFromPath(pathname)
  if (!locale) return pathname === '' ? '/' : pathname
  const rest = pathname.slice(locale.length + 1) || '/'
  return rest.startsWith('/') ? rest : `/${rest}`
}

export const withLocale = (path: string, locale: Locale) => {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (locale === DEFAULT_LOCALE) return normalized === '/' ? '/' : normalized
  if (normalized === '/') return `/${locale}`
  return `/${locale}${normalized}`
}

export const getBrowserLocale = (): Locale => {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    if (language.toLowerCase().startsWith('zh')) return 'zh'
    if (language.toLowerCase().startsWith('en')) return 'en'
  }
  return DEFAULT_LOCALE
}
