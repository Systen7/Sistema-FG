// Ajudantes dos testes de integração: limpar o banco e criar o básico (caminhão, motorista, viagem).
import { sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db, schema as s } from '@/db'
import { iniciarSessao } from '@/lib/auth'
import { cookiesDoTeste } from './ambiente'

export async function limpar() {
  const tabelas = await db.execute<{ t: string }>(sql`select tablename as t from pg_tables where schemaname = 'public'`)
  const nomes = tabelas.map((r) => `"${r.t}"`).join(', ')
  if (nomes) await db.execute(sql.raw(`truncate ${nomes} restart identity cascade`))
  cookiesDoTeste.clear()
}

export async function base({ placa = 'RKT4E21', inicio = '2026-10-10', pin = '1234' } = {}) {
  const [cam] = await db.insert(s.caminhoes).values({ placa, descricao: 'Scania R450' }).returning()
  const [mot] = await db
    .insert(s.motoristas)
    .values({ nome: 'Valdir Teste', telefone: '66900000001', pinHash: await bcrypt.hash(pin, 4), caminhaoId: cam.id, comissaoPct: 12 })
    .returning()
  const [v] = await db
    .insert(s.viagens)
    .values({
      motoristaId: mot.id,
      caminhaoId: cam.id,
      origem: 'Rondonópolis/MT',
      destino: 'Santos/SP',
      carga: 'Soja',
      frete: 1380000,
      comissaoPct: 12,
      inicio,
      kmInicial: 100000,
    })
    .returning()
  return { cam, mot, v }
}

/** Entra como o motorista (cookie de sessão de verdade, assinado como no login). */
export const entrarComo = (m: { id: number; versaoSessao: number }) => iniciarSessao({ tipo: 'motorista', id: m.id, v: m.versaoSessao })

export const arquivo = (nome: string, conteudo: string | Buffer, tipo = nome.endsWith('.pdf') ? 'application/pdf' : 'application/xml') =>
  new File([typeof conteudo === 'string' ? conteudo : new Uint8Array(conteudo)], nome, { type: tipo })

/** Cria um administrador (senha "senha-forte-1") e devolve a linha gravada. */
export async function criarAdmin(usuario = 'escritorio', senha = 'senha-forte-1') {
  const [a] = await db
    .insert(s.administradores)
    .values({ nome: `Admin ${usuario}`, usuario, senhaHash: await bcrypt.hash(senha, 4) })
    .returning()
  return a
}

/** Entra como administrador (cookie de sessão de verdade). Sem argumento, cria um administrador novo. */
export async function entrarComoAdmin(a?: { id: number; versaoSessao: number }) {
  const adm = a ?? (await criarAdmin())
  await iniciarSessao({ tipo: 'admin', id: adm.id, v: adm.versaoSessao })
  return adm
}

/** Monta um FormData a partir de um objeto simples. */
export const formulario = (campos: Record<string, string | File>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

/**
 * Executa uma server action. O redirect() do Next interrompe a ação lançando um erro com digest
 * "NEXT_REDIRECT;tipo;url;status;": aqui ele vira { redirect: url }. Outros retornos passam direto.
 */
export async function executar<T>(acao: () => Promise<T>): Promise<T | { redirect: string }> {
  try {
    return await acao()
  } catch (e) {
    const digest = String((e as { digest?: string })?.digest ?? '')
    if (digest.startsWith('NEXT_REDIRECT')) return { redirect: decodeURIComponent(digest.split(';').slice(2, -2).join(';')) }
    throw e
  }
}
