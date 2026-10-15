// Erros do navegador no Sentry. O SDK só é baixado quando NEXT_PUBLIC_SENTRY_DSN existe,
// para não pesar no celular do motorista à toa.
type SentryCliente = typeof import('@sentry/nextjs')
let sentry: SentryCliente | null = null
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  import('@sentry/nextjs')
    .then((S) => {
      const v = (process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '').trim()
      const n = Number(v)
      S.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
        tracesSampleRate: v && Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.1,
        dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
        // Erros de rede comuns no celular sem sinal não são defeito do sistema.
        ignoreErrors: ['Failed to fetch', 'NetworkError', 'Load failed', 'The network connection was lost'],
      })
      sentry = S
    })
    .catch(() => {})
}

export function onRouterTransitionStart(url: string, tipo: 'push' | 'replace' | 'traverse') {
  sentry?.captureRouterTransitionStart(url, tipo)
}
