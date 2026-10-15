// Configuração do Sentry comum ao servidor (Node) e ao edge.
// Sem SENTRY_DSN o Sentry fica desligado e o sistema funciona igual.
import type { ErrorEvent } from '@sentry/nextjs'

export const dsnServidor = () => process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || ''

/** Fração das requisições com rastreamento de desempenho no Sentry (padrão 10%). */
export const amostraTraces = () => {
  const n = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.1
}

const semToken = (u: string) => u.replace(/\/acesso\/[^/?#]+/g, '/acesso/[token]')

/** Nunca manda cookie de sessão, cabeçalho de autorização, link de acesso, PIN ou senha para fora. */
export function limparEvento<E extends ErrorEvent>(e: E): E {
  if (e.transaction) e.transaction = semToken(e.transaction)
  if (e.request) {
    if (e.request.url) e.request.url = semToken(e.request.url)
    delete e.request.cookies
    if (e.request.headers) for (const h of Object.keys(e.request.headers)) if (/cookie|authorization/i.test(h)) delete e.request.headers[h]
    if (typeof e.request.data === 'string' && /pin|senha/i.test(e.request.data)) e.request.data = '[removido]'
  }
  return e
}

export const baseSentry = () => ({
  dsn: dsnServidor(),
  enabled: !!dsnServidor(),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: amostraTraces(),
  // O mínimo de dados pessoais (LGPD): sem cookies, sem corpo das requisições, sem dados do usuário.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: { request: { deny: ['cookie', 'authorization'] }, response: false }, httpBodies: [] },
  beforeSend: limparEvento,
})
