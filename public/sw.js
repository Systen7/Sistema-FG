// Service worker do app do motorista.
// Páginas: tenta a rede e, sem sinal, mostra a última versão salva. Arquivos do app: guardados para abrir rápido.
const VERSAO = 'fg-v1'
const PAGINAS = 'fg-paginas-' + VERSAO
const ESTATICOS = 'fg-estaticos-' + VERSAO

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGINAS).then((c) => c.addAll(['/m', '/m/gasto']).catch(() => {})))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.endsWith(VERSAO)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((r) => r || fetch(req).then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(ESTATICOS).then((c) => c.put(req, copia)) }
        return res
      })),
    )
    return
  }

  if (req.mode === 'navigate' && url.pathname.startsWith('/m')) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok && !res.redirected) { const copia = res.clone(); caches.open(PAGINAS).then((c) => c.put(url.pathname, copia)) }
        return res
      }).catch(async () => (await caches.match(url.pathname)) || (await caches.match('/m')) || new Response(
        '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><body style="background:#04060a;color:#eef2f9;font:18px system-ui;padding:32px">Sem sinal agora. Abra o app de novo quando a internet voltar.',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )),
    )
  }
})
