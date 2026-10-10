import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const client = (env.VITE_ADSENSE_CLIENT || '').trim()
  const validClient = /^ca-pub-\d{16}$/.test(client)
  return {
    plugins: [react(), {
      name: 'adsense-ads-txt',
      buildStart() {
        if (!validClient && (client || env.VITE_ADSENSE_ENABLED === 'true')) {
          this.warn('AdSense is disabled: VITE_ADSENSE_CLIENT must be ca-pub- followed by 16 digits. The website will build without ads.')
        }
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'ads.txt', source: validClient
          ? `google.com, ${client.slice(3)}, DIRECT, f08c47fec0942fa0\n`
          : '# No advertising publisher configured.\n' })
      },
    }],
    server: {
      proxy: {
        '/api': 'http://localhost:4000',
        '/uploads': 'http://localhost:4000',
      },
    },
  }
})
