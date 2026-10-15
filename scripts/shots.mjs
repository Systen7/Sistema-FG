// Uso: node scripts/shots.mjs admin|motorista url1 url2 ...  (tira capturas de tela para revisão)
import { chromium } from '@playwright/test'
const [quem, ...urls] = process.argv.slice(2)
const base = process.env.BASE || 'http://localhost:3000'
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined })
const mobile = quem === 'motorista'
const ctx = await b.newContext(
  mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
)
const p = await ctx.newPage()
const erros = []
p.on('pageerror', (e) => erros.push(e.message))
p.on('console', (m) => {
  if (m.type() === 'error') erros.push(m.text())
})
await p.goto(`${base}/entrar`)
if (quem === 'admin') {
  await p.getByRole('button', { name: 'Escritório' }).click()
  await p.fill('input[name=usuario]', 'admin')
  await p.fill('input[name=senha]', 'fg2026')
  await p.getByRole('button', { name: 'Entrar' }).click()
  await p.waitForURL('**/admin')
} else {
  await p.fill('input[type=tel]', process.env.TEL || '66900000003')
  await p.getByRole('button', { name: 'Continuar' }).click()
  for (const d of process.env.PIN || '3333') await p.getByRole('button', { name: d, exact: true }).click()
  await p.waitForURL('**/m')
}
for (const u of urls) {
  await p.goto(base + u, { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  const nome = (quem + u.replace(/[^a-z0-9]+/gi, '_')).slice(0, 80)
  await p.screenshot({ path: `screenshots/${nome}.png`, fullPage: true })
  console.log('ok', u, '->', `screenshots/${nome}.png`)
}
if (erros.length) console.log(`ERROS NO NAVEGADOR:\n${erros.join('\n')}`)
await b.close()
