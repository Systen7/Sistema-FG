import type { ErrorEvent } from '@sentry/nextjs'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { amostraTraces, baseSentry, dsnServidor, limparEvento } from '@/lib/obs/sentry-config'

afterEach(() => vi.unstubAllEnvs())

const ev = (o: Partial<ErrorEvent> = {}) => ({ type: undefined, ...o }) as ErrorEvent

describe('limparEvento', () => {
  it('remove cookies e cabeçalhos de cookie/autorização, mantendo os demais', () => {
    const e = limparEvento(
      ev({
        request: {
          cookies: { fg_sessao: 'x' },
          headers: { Cookie: 'fg_sessao=x', authorization: 'Bearer y', 'Set-Cookie': 'a=b', 'Proxy-Authorization': 'z', 'user-agent': 'UA', accept: '*/*' },
        },
      }),
    )
    expect(e.request?.cookies).toBeUndefined()
    expect(e.request?.headers).toEqual({ 'user-agent': 'UA', accept: '*/*' })
  })
  it('troca o token do link de acesso na URL e na transação', () => {
    const e = limparEvento(ev({ transaction: 'GET /acesso/abc123', request: { url: 'https://fg.app/acesso/abc123?x=1#y' } }))
    expect(e.transaction).toBe('GET /acesso/[token]')
    expect(e.request?.url).toBe('https://fg.app/acesso/[token]?x=1#y')
    expect(limparEvento(ev({ request: { url: 'https://fg.app/acesso/a/b' } })).request?.url).toBe('https://fg.app/acesso/[token]/b')
  })
  it('não mexe em URLs sem link de acesso', () => {
    const e = limparEvento(ev({ transaction: '/admin/viagens', request: { url: 'https://fg.app/admin' } }))
    expect(e.transaction).toBe('/admin/viagens')
    expect(e.request?.url).toBe('https://fg.app/admin')
  })
  it('nunca envia o corpo da requisição, seja texto ou objeto', () => {
    expect(limparEvento(ev({ request: { data: '{"pin":"1234"}' } })).request?.data).toBe('[removido]')
    expect(limparEvento(ev({ request: { data: 'telefone=66900000001' } })).request?.data).toBe('[removido]')
    expect(limparEvento(ev({ request: { data: { pin: '1234' } } })).request?.data).toBe('[removido]')
  })
  it('aceita evento sem request, sem transação e request sem url/headers', () => {
    expect(limparEvento(ev())).toEqual(ev())
    expect(limparEvento(ev({ request: { method: 'GET' } })).request).toEqual({ method: 'GET' })
  })
  it('devolve o mesmo objeto', () => {
    const e = ev({ transaction: 'x' })
    expect(limparEvento(e)).toBe(e)
  })
})

describe('amostraTraces', () => {
  it('variável vazia usa o padrão de 10%', () => {
    vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', '')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '0.3')
    expect(amostraTraces()).toBe(0.3)
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', ' ')
    expect(amostraTraces()).toBe(0.1)
  })
  it('padrão 10% sem variável', () => {
    vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', undefined)
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', undefined)
    expect(amostraTraces()).toBe(0.1)
  })
  it('lê a variável do servidor, com prioridade sobre a pública', () => {
    vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', '0.5')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '0.2')
    expect(amostraTraces()).toBe(0.5)
  })
  it('usa a pública quando a do servidor não existe', () => {
    vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', undefined)
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '0.25')
    expect(amostraTraces()).toBe(0.25)
  })
  it('aceita os limites 0 e 1', () => {
    vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', '0')
    expect(amostraTraces()).toBe(0)
    vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', '1')
    expect(amostraTraces()).toBe(1)
  })
  it('valores inválidos voltam para 10%', () => {
    for (const v of ['abc', '-0.1', '1.5', 'Infinity', 'NaN']) {
      vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', v)
      expect(amostraTraces(), v).toBe(0.1)
    }
  })
})

describe('dsnServidor e baseSentry', () => {
  it('ordem: SENTRY_DSN, depois NEXT_PUBLIC_SENTRY_DSN, senão vazio', () => {
    vi.stubEnv('SENTRY_DSN', 'https://a@s/1')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://b@s/2')
    expect(dsnServidor()).toBe('https://a@s/1')
    vi.stubEnv('SENTRY_DSN', '')
    expect(dsnServidor()).toBe('https://b@s/2')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    expect(dsnServidor()).toBe('')
  })
  it('desligado sem DSN', () => {
    vi.stubEnv('SENTRY_DSN', '')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    expect(baseSentry()).toMatchObject({ dsn: '', enabled: false, beforeSend: limparEvento })
  })
  it('ligado com DSN, ambiente da Vercel e release do commit', () => {
    vi.stubEnv('SENTRY_DSN', 'https://a@s/1')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc')
    vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', '0.3')
    const b = baseSentry()
    expect(b).toMatchObject({ dsn: 'https://a@s/1', enabled: true, environment: 'preview', release: 'abc', tracesSampleRate: 0.3 })
    expect(b.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpBodies: [] })
  })
  it('sem VERCEL_ENV usa NODE_ENV', () => {
    vi.stubEnv('VERCEL_ENV', undefined)
    vi.stubEnv('NODE_ENV', 'production')
    expect(baseSentry().environment).toBe('production')
  })
})
