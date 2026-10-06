type RuntimeConfig = Record<string, unknown>

const getRuntimeConfig = (): RuntimeConfig => {
  if (typeof document === 'undefined') return {}

  const content = document.querySelector('#app-config')?.textContent
  if (!content?.trim()) return {}

  try {
    const config = JSON.parse(content)
    return config && typeof config === 'object' && !Array.isArray(config) ? config : {}
  } catch (error) {
    console.error('Failed to parse app config', error)
    return {}
  }
}

const runtimeConfig = getRuntimeConfig()

const getStringConfigValue = (key: string, buildValue: string): string => {
  const runtimeValue = runtimeConfig[key]
  return typeof runtimeValue === 'string' ? runtimeValue : buildValue
}

export const APP_CONFIG = {
  API_BASE: getStringConfigValue('API_BASE', import.meta.env.VITE_API_BASE || ''),
  CF_WEB_ANALY_TOKEN: getStringConfigValue('CF_WEB_ANALY_TOKEN', import.meta.env.VITE_CF_WEB_ANALY_TOKEN || ''),
} as const
