import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4181', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4181 --strictPort', url: 'http://127.0.0.1:4181', reuseExistingServer: false },
})
