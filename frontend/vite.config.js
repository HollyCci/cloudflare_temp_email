import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  build: {
    outDir: './dist',
  },
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['react', 'react/jsx-runtime', '@heroui-pro/react'],
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(process.env.npm_package_version),
  },
  test: {
    environment: 'jsdom',
  },
})
