import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

const resolveCss = () => {
  try {
    return join(dirname(require.resolve('@heroui-pro/react/package.json')), 'dist/css/index.css')
  } catch {
    return null
  }
}

if (resolveCss() && existsSync(resolveCss())) {
  console.log('[heroui-pro] artifacts are ready.')
  process.exit(0)
}

const key = process.env.HEROUI_SETUP_KEY
if (!key) {
  console.warn('[heroui-pro] CSS missing. Set HEROUI_SETUP_KEY and run: npx hpsetup@latest "$HEROUI_SETUP_KEY" react')
  process.exit(0)
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['-y', 'hpsetup@latest', key, 'react'],
  { stdio: 'inherit', env: process.env },
)

process.exit(result.status ?? 1)
