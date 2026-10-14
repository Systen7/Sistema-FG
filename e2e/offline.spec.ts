import { test, expect } from '@playwright/test'

// Só em produção (o service worker não roda no modo de desenvolvimento): o app abre mesmo sem sinal.
test('app do motorista abre sem sinal depois de usado uma vez', async ({ browser }) => {
  test.skip(!process.env.PROD, 'rode com PROD=1 contra "next start"')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  await p.goto('/entrar')
  await p.fill('input[type=tel]', '66900000003')
  await p.getByRole('button', { name: 'Continuar' }).click()
  for (const d of '3333') await p.getByRole('button', { name: d, exact: true }).click()
  await p.waitForURL('**/m')
  await p.evaluate(() => navigator.serviceWorker.ready)
  await p.reload()
  await expect(p.getByText('Sorriso/MT')).toBeVisible()
  await ctx.setOffline(true)
  await p.reload()
  await expect(p.getByText('Sorriso/MT')).toBeVisible()
  await expect(p.getByText('Sem sinal')).toBeVisible()
})
