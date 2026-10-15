'use server'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { bloqueado, confere, iniciarSessao, limparFalhas, registrarFalha, encerrarSessao } from '@/lib/auth'
import { soDigitos } from '@/lib/format'

export type Resp = { erro?: string; restam?: number } | undefined

export async function entrarMotorista(telefone: string, pin: string): Promise<Resp> {
  const tel = soDigitos(telefone)
  if (tel.length < 10) return { erro: 'Digite o celular com DDD.' }
  if (!/^\d{4}$/.test(pin)) return { erro: 'O PIN tem 4 números.' }
  const chave = `tel:${tel}`
  const min = await bloqueado(chave)
  if (min) return { erro: `Muitas tentativas erradas. Tente de novo em ${min} min ou peça ajuda ao escritório.` }
  const [m] = await db.select().from(s.motoristas).where(eq(s.motoristas.telefone, tel))
  if (!m?.ativo || !(await confere(pin, m.pinHash))) {
    const restam = await registrarFalha(chave)
    return { erro: restam > 0 ? 'Celular ou PIN não conferem.' : 'Muitas tentativas erradas. Aguarde 15 min.', restam }
  }
  await limparFalhas(chave)
  await iniciarSessao({ tipo: 'motorista', id: m.id, v: m.versaoSessao })
  redirect('/m')
}

export async function entrarAdmin(usuario: string, senha: string): Promise<Resp> {
  const u = usuario.trim().toLowerCase()
  if (!u || !senha) return { erro: 'Preencha usuário e senha.' }
  const chave = `adm:${u}`
  const min = await bloqueado(chave)
  if (min) return { erro: `Muitas tentativas erradas. Tente de novo em ${min} min.` }
  const [a] = await db.select().from(s.administradores).where(eq(s.administradores.usuario, u))
  if (!a || !(await confere(senha, a.senhaHash))) {
    await registrarFalha(chave)
    return { erro: 'Usuário ou senha incorretos.' }
  }
  await limparFalhas(chave)
  await iniciarSessao({ tipo: 'admin', id: a.id, v: a.versaoSessao })
  redirect('/admin')
}

export async function sair() {
  await encerrarSessao()
  redirect('/entrar')
}
