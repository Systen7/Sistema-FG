import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // No CI: relatório HTML e, quando falha, rastro (trace), vídeo e foto da tela para ver o que aconteceu.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CHROME || undefined },
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
})
