import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: process.env.BASE || 'http://localhost:3000',
    launchOptions: { executablePath: process.env.CHROME || undefined },
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
})
