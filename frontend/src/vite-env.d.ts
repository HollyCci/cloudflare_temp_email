/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_DEFAULT_LANG?: string
  readonly VITE_CF_WEB_ANALY_TOKEN?: string
  readonly VITE_IS_TELEGRAM?: string
  readonly VITE_GOOGLE_AD_CLIENT?: string
  readonly VITE_GOOGLE_AD_SLOT?: string
  readonly PACKAGE_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export {}

declare global {
  interface Window {
    turnstile?: {
      render: (selector: string, options: Record<string, unknown>) => string
      remove: (id: string) => void
    }
    Telegram?: {
      WebApp?: {
        initData?: string
      }
    }
  }
}
