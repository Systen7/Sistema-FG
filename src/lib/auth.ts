import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'

import { COOKIE_NOME } from './token-edge'
export const COOKIE = COOKIE_NOME
const DIA = 86400
const DURACAO = { motorista: 180 * DIA, admin: 30 * DIA }

export type Sessao = { tipo: 'admin' | 'motorista'; id: number; v: number }

function segredo() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 24) throw new Error('Defina SESSION_SECRET no ambiente (pelo menos 24 caracteres).')
  return new TextEncoder().encode(s)
}

export async function assinar(s: Sessao) {
  return new SignJWT({ ...s }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + DURACAO[s.tipo]).sign(segredo())
}
export async function verificar(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, segredo())
    if ((payload.tipo === 'admin' || payload.tipo === 'motorista') && typeof payload.id === 'number') return { tipo: payload.tipo, id: payload.id, v: Number(payload.v) || 1 }
  } catch {}
  return null
}

export async function iniciarSessao(s: Sessao) {
  const jar = await cookies()
  jar.set(COOKIE, await assinar(s), {
    httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' && !process.env.INSECURE_COOKIES, maxAge: DURACAO[s.tipo],
  })
}
export async function encerrarSessao() {
  ;(await cookies()).delete(COOKIE)
}

export async function sessaoAtual(): Promise<Sessao | null> {
  return verificar((await cookies()).get(COOKIE)?.value)
}

export async function exigirAdmin() {
  const s = await sessaoAtual()
  if (s?.tipo !== 'admin') redirect('/entrar')
  const [a] = await db.select().from(schema.administradores).where(eq(schema.administradores.id, s.id))
  if (!a || a.versaoSessao !== s.v) redirect('/entrar?saiu=1')
  return a
}

export async function exigirMotorista() {
  const s = await sessaoAtual()
  if (s?.tipo !== 'motorista') redirect('/entrar')
  const [m] = await db.select().from(schema.motoristas).where(eq(schema.motoristas.id, s.id))
  if (!m || !m.ativo || m.versaoSessao !== s.v) redirect('/entrar?saiu=1')
  return m
}

/** Versão para rotas de API: devolve null em vez de redirecionar. */
export async function motoristaDaApi() {
  const s = await sessaoAtual()
  if (s?.tipo !== 'motorista') return null
  const [m] = await db.select().from(schema.motoristas).where(eq(schema.motoristas.id, s.id))
  return m && m.ativo && m.versaoSessao === s.v ? m : null
}
export async function adminDaApi() {
  const s = await sessaoAtual()
  if (s?.tipo !== 'admin') return null
  const [a] = await db.select().from(schema.administradores).where(eq(schema.administradores.id, s.id))
  return a && a.versaoSessao === s.v ? a : null
}

export const hash = (s: string) => bcrypt.hash(s, 10)
export const confere = (s: string, h: string) => bcrypt.compare(s, h)

// Bloqueio após tentativas erradas: 5 erros seguidos travam por 15 minutos.
const LIMITE = 5, BLOQUEIO_MIN = 15
export async function bloqueado(chave: string): Promise<number> {
  const [t] = await db.select().from(schema.tentativasLogin).where(eq(schema.tentativasLogin.chave, chave))
  if (t?.bloqueadoAte && t.bloqueadoAte > new Date()) return Math.ceil((t.bloqueadoAte.getTime() - Date.now()) / 60000)
  return 0
}
export async function registrarFalha(chave: string) {
  const [t] = await db.select().from(schema.tentativasLogin).where(eq(schema.tentativasLogin.chave, chave))
  const falhas = (t?.bloqueadoAte && t.bloqueadoAte <= new Date() ? 0 : t?.falhas ?? 0) + 1
  const bloqueadoAte = falhas >= LIMITE ? new Date(Date.now() + BLOQUEIO_MIN * 60000) : null
  await db.insert(schema.tentativasLogin).values({ chave, falhas, bloqueadoAte })
    .onConflictDoUpdate({ target: schema.tentativasLogin.chave, set: { falhas: bloqueadoAte ? 0 : falhas, bloqueadoAte } })
  return LIMITE - falhas
}
export async function limparFalhas(chave: string) {
  await db.delete(schema.tentativasLogin).where(eq(schema.tentativasLogin.chave, chave))
}
