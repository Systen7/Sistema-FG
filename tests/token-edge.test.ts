import { SignJWT } from 'jose'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { COOKIE_NOME, tipoDoToken } from '@/lib/token-edge'

const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente-123'
const assinar = (payload: Record<string, unknown>, segredo = SEGREDO, exp: string | number = '1h') =>
  new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(exp).sign(new TextEncoder().encode(segredo))

afterEach(() => vi.unstubAllEnvs())

describe('tipoDoToken', () => {
  it('nome do cookie', () => {
    expect(COOKIE_NOME).toBe('fg_sessao')
  })
  it('reconhece admin e motorista', async () => {
    vi.stubEnv('SESSION_SECRET', SEGREDO)
    expect(await tipoDoToken(await assinar({ tipo: 'admin', id: 1 }))).toBe('admin')
    expect(await tipoDoToken(await assinar({ tipo: 'motorista', id: 2 }))).toBe('motorista')
  })
  it('tipo desconhecido ou ausente → null', async () => {
    vi.stubEnv('SESSION_SECRET', SEGREDO)
    expect(await tipoDoToken(await assinar({ tipo: 'root' }))).toBeNull()
    expect(await tipoDoToken(await assinar({ id: 1 }))).toBeNull()
  })
  it('assinado com outro segredo → null', async () => {
    vi.stubEnv('SESSION_SECRET', SEGREDO)
    expect(await tipoDoToken(await assinar({ tipo: 'admin' }, 'outro-segredo-qualquer-com-tamanho-ok'))).toBeNull()
  })
  it('token expirado ou malformado → null', async () => {
    vi.stubEnv('SESSION_SECRET', SEGREDO)
    expect(await tipoDoToken(await assinar({ tipo: 'admin' }, SEGREDO, Math.floor(Date.now() / 1000) - 60))).toBeNull()
    expect(await tipoDoToken('nao.e.jwt')).toBeNull()
  })
  it('sem SESSION_SECRET ou sem token → null', async () => {
    const t = await assinar({ tipo: 'admin' })
    vi.stubEnv('SESSION_SECRET', '')
    expect(await tipoDoToken(t)).toBeNull()
    vi.stubEnv('SESSION_SECRET', SEGREDO)
    expect(await tipoDoToken(undefined)).toBeNull()
    expect(await tipoDoToken('')).toBeNull()
  })
})
