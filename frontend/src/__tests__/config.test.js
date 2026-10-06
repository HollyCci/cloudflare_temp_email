// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setRuntimeConfig = (config) => {
  const element = document.createElement('script')
  element.id = 'app-config'
  element.type = 'application/json'
  element.textContent = JSON.stringify(config)
  document.head.appendChild(element)
}

describe('APP_CONFIG', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE', 'https://build.example.com')
    vi.stubEnv('VITE_CF_WEB_ANALY_TOKEN', 'build-token')
    vi.stubEnv('VITE_IS_TELEGRAM', 'false')
  })

  afterEach(() => {
    document.querySelector('#app-config')?.remove()
    vi.unstubAllEnvs()
  })

  it('uses build settings when runtime settings are absent', async () => {
    const { APP_CONFIG } = await import('../config')

    expect(APP_CONFIG.API_BASE).toBe('https://build.example.com')
    expect(APP_CONFIG.CF_WEB_ANALY_TOKEN).toBe('build-token')
  })

  it('overrides only settings provided by index.html', async () => {
    setRuntimeConfig({ API_BASE: 'https://runtime.example.com', CF_WEB_ANALY_TOKEN: 'runtime-token' })

    const { APP_CONFIG } = await import('../config')

    expect(APP_CONFIG.API_BASE).toBe('https://runtime.example.com')
    expect(APP_CONFIG.CF_WEB_ANALY_TOKEN).toBe('runtime-token')
  })

  it('allows an explicit empty runtime value', async () => {
    setRuntimeConfig({ API_BASE: '' })

    const { APP_CONFIG } = await import('../config')

    expect(APP_CONFIG.API_BASE).toBe('')
    expect(APP_CONFIG.CF_WEB_ANALY_TOKEN).toBe('build-token')
  })

  it('falls back to build settings for invalid runtime value types', async () => {
    setRuntimeConfig({ API_BASE: {}, CF_WEB_ANALY_TOKEN: 1, IS_TELEGRAM: [] })

    const { APP_CONFIG } = await import('../config')

    expect(APP_CONFIG.API_BASE).toBe('https://build.example.com')
    expect(APP_CONFIG.CF_WEB_ANALY_TOKEN).toBe('build-token')
    expect(APP_CONFIG.IS_TELEGRAM).toBe('false')
  })

  it('reads runtime settings only once', async () => {
    setRuntimeConfig({ CF_WEB_ANALY_TOKEN: 'first-token' })
    const firstImport = await import('../config')

    document.querySelector('#app-config').textContent = JSON.stringify({ CF_WEB_ANALY_TOKEN: 'second-token' })
    const secondImport = await import('../config')

    expect(secondImport.APP_CONFIG).toBe(firstImport.APP_CONFIG)
    expect(secondImport.APP_CONFIG.CF_WEB_ANALY_TOKEN).toBe('first-token')
  })
})
