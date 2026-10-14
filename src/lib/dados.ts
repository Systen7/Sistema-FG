import 'server-only'
import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import type { ViagemCompleta } from './calc'
import { dataDe, somaMeses } from './datas'

export async function config() {
  const [c] = await db.select().from(s.configuracao).where(eq(s.configuracao.id, 1))
  if (c) return c
  const [n] = await db.insert(s.configuracao).values({ id: 1 }).onConflictDoNothing().returning()
  return n ?? (await db.select().from(s.configuracao))[0]
}

async function comDespesas(vs: (typeof s.viagens.$inferSelect)[]): Promise<ViagemCompleta[]> {
  if (!vs.length) return []
  const ds = await db.select().from(s.despesas).where(inArray(s.despesas.viagemId, vs.map((v) => v.id))).orderBy(asc(s.despesas.data), asc(s.despesas.id))
  return vs.map((v) => ({ ...v, despesas: ds.filter((d) => d.viagemId === v.id) }))
}

/** Viagens que começaram no mês (AAAA-MM). */
export async function viagensDoMes(mes: string, filtro?: { motoristaId?: number; caminhaoId?: number }) {
  const conds = [gte(s.viagens.inicio, mes + '-01'), lt(s.viagens.inicio, somaMeses(mes, 1) + '-01')]
  if (filtro?.motoristaId) conds.push(eq(s.viagens.motoristaId, filtro.motoristaId))
  if (filtro?.caminhaoId) conds.push(eq(s.viagens.caminhaoId, filtro.caminhaoId))
  return comDespesas(await db.select().from(s.viagens).where(and(...conds)).orderBy(desc(s.viagens.inicio), desc(s.viagens.id)))
}

export async function viagensFiltradas(f: { status?: 'andamento' | 'encerrada'; motoristaId?: number; mes?: string }) {
  const conds = []
  if (f.status) conds.push(eq(s.viagens.status, f.status))
  if (f.motoristaId) conds.push(eq(s.viagens.motoristaId, f.motoristaId))
  if (f.mes) conds.push(gte(s.viagens.inicio, f.mes + '-01'), lt(s.viagens.inicio, somaMeses(f.mes, 1) + '-01'))
  return comDespesas(await db.select().from(s.viagens).where(conds.length ? and(...conds) : undefined).orderBy(desc(s.viagens.inicio), desc(s.viagens.id)).limit(300))
}

export async function todasEncerradas() {
  return comDespesas(await db.select().from(s.viagens).where(eq(s.viagens.status, 'encerrada')))
}

export async function viagem(id: number) {
  const [v] = await db.select().from(s.viagens).where(eq(s.viagens.id, id))
  return v ? (await comDespesas([v]))[0] : null
}

export async function viagemAtiva(motoristaId: number) {
  const [v] = await db.select().from(s.viagens).where(and(eq(s.viagens.motoristaId, motoristaId), eq(s.viagens.status, 'andamento')))
  return v ? (await comDespesas([v]))[0] : null
}

export async function emAndamento() {
  return comDespesas(await db.select().from(s.viagens).where(eq(s.viagens.status, 'andamento')).orderBy(asc(s.viagens.inicio)))
}

export async function pendentes() {
  return db.select({ d: s.despesas, v: s.viagens }).from(s.despesas).innerJoin(s.viagens, eq(s.despesas.viagemId, s.viagens.id))
    .where(eq(s.despesas.status, 'pendente')).orderBy(asc(s.despesas.criadoEm))
}

export const motoristas = () => db.select().from(s.motoristas).orderBy(desc(s.motoristas.ativo), asc(s.motoristas.nome))
export const caminhoes = () => db.select().from(s.caminhoes).orderBy(desc(s.caminhoes.ativo), asc(s.caminhoes.placa))
export const manutencoes = () => db.select().from(s.manutencoes).orderBy(desc(s.manutencoes.data), desc(s.manutencoes.id))
export const apolices = () => db.select().from(s.apolices).orderBy(asc(s.apolices.nome))
export const custosFixos = () => db.select().from(s.custosFixos).orderBy(asc(s.custosFixos.nome))
export const lembretes = () => db.select().from(s.lembretes).orderBy(asc(s.lembretes.data))
export const pneus = () => db.select().from(s.pneus).orderBy(asc(s.pneus.caminhaoId), asc(s.pneus.posicao))
export const dispensados = async () => new Set((await db.select().from(s.alertasDispensados)).map((x) => x.chave))
export const acertosDoMes = (mes: string) => db.select().from(s.acertos).where(eq(s.acertos.mes, mes))

/** Meses com viagens, do mais recente ao mais antigo, sempre incluindo o mês atual. */
export async function mesesDisponiveis(atual: string) {
  const r = await db.execute<{ m: string }>(sql`SELECT DISTINCT to_char(inicio, 'YYYY-MM') AS m FROM viagens ORDER BY m DESC LIMIT 24`)
  const ms = new Set<string>([atual, ...Array.from(r as unknown as { m: string }[]).map((x) => x.m)])
  return [...ms].filter((m) => m <= atual).sort().reverse()
}

/** Cidades e cargas já usadas, para sugerir ao motorista e evitar digitação. */
export async function sugestoes(motoristaId?: number) {
  const base = db.select({ origem: s.viagens.origem, destino: s.viagens.destino, carga: s.viagens.carga, inicio: s.viagens.inicio }).from(s.viagens)
  const vs = await (motoristaId ? base.where(eq(s.viagens.motoristaId, motoristaId)) : base).orderBy(desc(s.viagens.inicio)).limit(200)
  const conta = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).map((x) => x[0])
  const rotas: { origem: string; destino: string; carga: string }[] = []
  for (const v of vs) if (!rotas.some((r) => r.origem === v.origem && r.destino === v.destino) && rotas.length < 4) rotas.push(v)
  return { cidades: conta(vs.flatMap((v) => [v.origem, v.destino])).slice(0, 30), cargas: conta(vs.map((v) => v.carga)).slice(0, 12), rotas }
}


/** MDF-e autorizados e ainda não encerrados, com a situação da viagem. */
export async function mdfeAbertos() {
  const r = await db.select({ d: s.documentos, st: s.viagens.status }).from(s.documentos)
    .leftJoin(s.viagens, eq(s.documentos.viagemId, s.viagens.id))
    .where(and(eq(s.documentos.tipo, 'mdfe'), eq(s.documentos.situacao, 'autorizado')))
  return r.map(({ d, st }) => ({ id: d.id, numero: d.numero, emitidoEm: dataDe(d.emitidoEm), viagemId: d.viagemId, viagemEncerrada: st === 'encerrada' }))
}
