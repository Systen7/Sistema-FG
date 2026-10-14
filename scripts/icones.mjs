// Gera os ícones do app (PNG) a partir da marca FG. Uso: node scripts/icones.mjs
import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined })
const p = await b.newPage()
const marca = (tam, margem) => `<!doctype html><html><head><style>
@import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500&display=block');
html,body{margin:0;width:${tam}px;height:${tam}px;background:#04060a;overflow:hidden}
.c{position:absolute;inset:0;background:radial-gradient(120% 120% at 100% 0%,#0f2760 0%,transparent 60%)}
.q{position:absolute;inset:${margem}px;border:${Math.max(2, tam / 64)}px solid #7ea6ff;display:grid;place-items:center;color:#7ea6ff;
font-family:'Bodoni Moda',Georgia,serif;font-weight:500;font-size:${(tam - margem * 2) * 0.46}px;letter-spacing:-.02em}
</style></head><body><div class="c"></div><div class="q">FG</div></body></html>`
for (const [nome, tam, margem] of [['icon-192.png', 192, 30], ['icon-512.png', 512, 80], ['icon-maskable-512.png', 512, 130], ['apple-touch-icon.png', 180, 28], ['favicon-32.png', 32, 3]]) {
  await p.setViewportSize({ width: tam, height: tam })
  await p.setContent(marca(tam, margem), { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: 'public/' + nome })
  console.log('public/' + nome)
}
await b.close()
