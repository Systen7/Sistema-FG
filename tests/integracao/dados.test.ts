import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import * as dados from '@/lib/dados'
import { importarArquivos } from '@/lib/documentos'
import { CTE, ENCERRAMENTO, MDFE, chave } from '../xml-exemplos'
import { arquivo, base, limpar } from './banco'

beforeEach(limpar)

type NovaViagem = Partial<typeof s.viagens.$inferInsert> & { motoristaId: number; caminhaoId: number }
const viagem = async (v: NovaViagem) =>
  (
    await db
      .insert(s.viagens)
      .values({ origem: 'A/MT', destino: 'B/SP', carga: 'Soja', frete: 100000, comissaoPct: 10, inicio: '2026-10-01', kmInicial: 1, status: 'encerrada', ...v })
      .returning()
  )[0]

/** Base + um segundo motorista/caminhão, e viagens encerradas em setembro e outubro. */
async function cenario() {
  const b = await base()
  const [cam2] = await db.insert(s.caminhoes).values({ placa: 'XYZ9A99', descricao: 'Volvo' }).returning()
  const [mot2] = await db.insert(s.motoristas).values({ nome: 'Ana', telefone: '66900000002', pinHash: 'x', caminhaoId: cam2.id }).returning()
  const set = await viagem({ motoristaId: b.mot.id, caminhaoId: b.cam.id, inicio: '2026-09-30', origem: 'Sorriso/MT', destino: 'Santos/SP' })
  const out1 = await viagem({ motoristaId: b.mot.id, caminhaoId: b.cam.id, inicio: '2026-10-01', origem: 'Sorriso/MT', destino: 'Santos/SP' })
  const out2 = await viagem({ motoristaId: mot2.id, caminhaoId: cam2.id, inicio: '2026-10-31', origem: 'Sinop/MT', destino: 'Paranaguá/PR', carga: 'Milho' })
  const nov = await viagem({ motoristaId: mot2.id, caminhaoId: cam2.id, inicio: '2026-11-01' })
  return { ...b, cam2, mot2, set, out1, out2, nov }
}

describe('consultas do painel (lib/dados)', () => {
  it('config: cria a linha com os padrões na primeira leitura e depois reaproveita', async () => {
    const c = await dados.config()
    expect(c).toMatchObject({ id: 1, diasAviso: 60, diasUrgente: 20, kmAvisoRevisao: 5000, sulcoMinimo: 3, retornoPct: 60, nomeEmpresa: 'Empresa FG' })
    await db.update(s.configuracao).set({ retornoPct: 40 })
    expect((await dados.config()).retornoPct).toBe(40)
    const [a, b] = await Promise.all([dados.config(), dados.config()])
    expect(a.id).toBe(b.id)
    expect(await db.select().from(s.configuracao)).toHaveLength(1)
  })

  it('config: duas primeiras leituras ao mesmo tempo não duplicam nem falham', async () => {
    const rs = await Promise.all([dados.config(), dados.config(), dados.config()])
    expect(rs.every((c) => c.id === 1)).toBe(true)
    expect(await db.select().from(s.configuracao)).toHaveLength(1)
  })

  it('viagensDoMes: só as que começaram no mês (incluindo 1º e último dia), mais recentes primeiro, com gastos', async () => {
    const { v, out1, out2, mot, cam2 } = await cenario()
    await db.insert(s.despesas).values([
      { viagemId: out1.id, tipo: 'Pedágio', valor: 100, data: '2026-10-03' },
      { viagemId: out1.id, tipo: 'Diesel', valor: 200, litros: 50, data: '2026-10-02' },
      { viagemId: out2.id, tipo: 'Estadia', valor: 300, data: '2026-10-31' },
    ])
    const out = await dados.viagensDoMes('2026-10')
    expect(out.map((x) => x.id)).toEqual([out2.id, v.id, out1.id])
    const o1 = out.find((x) => x.id === out1.id)!
    expect(o1.despesas.map((d) => d.tipo)).toEqual(['Diesel', 'Pedágio'])
    expect(out.find((x) => x.id === v.id)!.despesas).toEqual([])

    expect((await dados.viagensDoMes('2026-10', { motoristaId: mot.id })).map((x) => x.id)).toEqual([v.id, out1.id])
    expect((await dados.viagensDoMes('2026-10', { caminhaoId: cam2.id })).map((x) => x.id)).toEqual([out2.id])
    expect(await dados.viagensDoMes('2025-01')).toEqual([])
  })

  it('viagensDoMes: virada de ano (dezembro → janeiro)', async () => {
    const { mot, cam } = await base()
    const dez = await viagem({ motoristaId: mot.id, caminhaoId: cam.id, inicio: '2026-12-31' })
    await viagem({ motoristaId: mot.id, caminhaoId: cam.id, inicio: '2027-01-01' })
    expect((await dados.viagensDoMes('2026-12')).map((x) => x.id)).toEqual([dez.id])
  })

  it('viagensFiltradas, todasEncerradas, viagem e emAndamento', async () => {
    const { v, set, out1, out2, nov, mot } = await cenario()
    expect((await dados.viagensFiltradas({ status: 'andamento' })).map((x) => x.id)).toEqual([v.id])
    expect((await dados.viagensFiltradas({ motoristaId: mot.id, mes: '2026-09' })).map((x) => x.id)).toEqual([set.id])
    expect(await dados.viagensFiltradas({})).toHaveLength(5)
    expect((await dados.todasEncerradas()).map((x) => x.id).sort()).toEqual([set.id, out1.id, out2.id, nov.id].sort())
    expect((await dados.viagem(v.id))?.despesas).toEqual([])
    expect(await dados.viagem(9999)).toBeNull()
    expect((await dados.emAndamento()).map((x) => x.id)).toEqual([v.id])
  })

  it('viagemAtiva: a viagem em andamento do motorista, ou null', async () => {
    const { v, mot, mot2 } = await cenario()
    await db.insert(s.despesas).values({ viagemId: v.id, tipo: 'Pedágio', valor: 990, data: '2026-10-11' })
    const ativa = await dados.viagemAtiva(mot.id)
    expect(ativa?.id).toBe(v.id)
    expect(ativa?.despesas.map((d) => d.valor)).toEqual([990])
    expect(await dados.viagemAtiva(mot2.id)).toBeNull()
  })

  it('pendentes: só gastos pendentes, do mais antigo ao mais novo, com a viagem junto', async () => {
    const { v, out1 } = await cenario()
    const [a] = await db
      .insert(s.despesas)
      .values({ viagemId: v.id, tipo: 'Pedágio', valor: 1, data: '2026-10-11', criadoEm: new Date('2026-10-11T10:00:00Z') })
      .returning()
    const [b] = await db
      .insert(s.despesas)
      .values({ viagemId: out1.id, tipo: 'Pedágio', valor: 2, data: '2026-10-02', criadoEm: new Date('2026-10-02T10:00:00Z') })
      .returning()
    await db.insert(s.despesas).values([
      { viagemId: v.id, tipo: 'Pedágio', valor: 3, data: '2026-10-11', status: 'aprovada' },
      { viagemId: v.id, tipo: 'Pedágio', valor: 4, data: '2026-10-11', status: 'recusada' },
    ])
    const ps = await dados.pendentes()
    expect(ps.map((p) => p.d.id)).toEqual([b.id, a.id])
    expect(ps[0].v.id).toBe(out1.id)
  })

  it('listas de cadastro: ativos primeiro e em ordem alfabética', async () => {
    const { mot, mot2, cam, cam2 } = await cenario()
    await db.update(s.motoristas).set({ ativo: false }).where(eq(s.motoristas.id, mot2.id))
    const [z] = await db.insert(s.motoristas).values({ nome: 'Zeca', telefone: '66900000003', pinHash: 'x' }).returning()
    expect((await dados.motoristas()).map((m) => m.id)).toEqual([mot.id, z.id, mot2.id])
    expect((await dados.caminhoes()).map((c) => c.id)).toEqual([cam.id, cam2.id])
    await db.insert(s.manutencoes).values([
      { caminhaoId: cam.id, data: '2026-09-01', tipo: 'Preventiva', descricao: 'a', valor: 1 },
      { caminhaoId: cam.id, data: '2026-10-01', tipo: 'Corretiva', descricao: 'b', valor: 2 },
    ])
    expect((await dados.manutencoes()).map((m) => m.data)).toEqual(['2026-10-01', '2026-09-01'])
    await db.insert(s.lembretes).values([
      { texto: 'b', data: '2026-12-01' },
      { texto: 'a', data: '2026-11-01' },
    ])
    expect((await dados.lembretes()).map((l) => l.texto)).toEqual(['a', 'b'])
    await db.insert(s.apolices).values([
      { nome: 'Z', cobertura: 'x', custoMensal: 1 },
      { nome: 'A', cobertura: 'x', custoMensal: 1 },
    ])
    expect((await dados.apolices()).map((a) => a.nome)).toEqual(['A', 'Z'])
    await db.insert(s.custosFixos).values({ nome: 'Contador', valorMensal: 50000 })
    expect(await dados.custosFixos()).toHaveLength(1)
    expect(await dados.pneus()).toEqual([])
    await db.insert(s.alertasDispensados).values({ chave: 'cnh:1' })
    expect(await dados.dispensados()).toEqual(new Set(['cnh:1']))
    await db.insert(s.acertos).values([
      { motoristaId: mot.id, mes: '2026-10', valor: 1 },
      { motoristaId: mot.id, mes: '2026-09', valor: 2 },
    ])
    expect((await dados.acertosDoMes('2026-10')).map((a) => a.valor)).toEqual([1])
  })

  it('mesesDisponiveis: meses com viagens, sem futuro, sempre com o mês atual, do mais novo ao mais antigo', async () => {
    await cenario()
    expect(await dados.mesesDisponiveis('2026-10')).toEqual(['2026-10', '2026-09'])
    expect(await dados.mesesDisponiveis('2026-12')).toEqual(['2026-12', '2026-11', '2026-10', '2026-09'])
    await limpar()
    expect(await dados.mesesDisponiveis('2026-10')).toEqual(['2026-10'])
  })

  it('sugestoes: cidades e cargas mais usadas primeiro e até 4 rotas sem repetir', async () => {
    const { mot } = await cenario()
    const geral = await dados.sugestoes()
    expect(geral.cidades.slice(0, 2).sort()).toEqual(['Santos/SP', 'Sorriso/MT'])
    expect(geral.cidades).toContain('Paranaguá/PR')
    expect(geral.cargas[0]).toBe('Soja')
    expect(geral.cargas).toContain('Milho')
    expect(geral.rotas.length).toBeLessThanOrEqual(4)
    expect(new Set(geral.rotas.map((r) => `${r.origem}>${r.destino}`)).size).toBe(geral.rotas.length)

    const doMot = await dados.sugestoes(mot.id)
    expect(doMot.cargas).toEqual(['Soja'])
    expect(doMot.cidades).not.toContain('Paranaguá/PR')
    expect(doMot.rotas.map((r) => r.origem)).toEqual(['Rondonópolis/MT', 'Sorriso/MT'])
  })

  it('mdfeAbertos: só MDF-e autorizado, com a situação da viagem ligada', async () => {
    const { v } = await base()
    const m1 = chave('58', 1)
    const m2 = chave('58', 2)
    const c1 = chave('57', 10)
    await importarArquivos(
      [arquivo('a.xml', MDFE(m1, c1)), arquivo('b.xml', MDFE(m2, c1, '2026-10-10', 'ABC-1D23')), arquivo('c.xml', CTE(c1))],
      null,
      'admin:1',
    )
    const [d1] = await db.select().from(s.documentos).where(eq(s.documentos.chave, m1))
    const [d2] = await db.select().from(s.documentos).where(eq(s.documentos.chave, m2))
    let abertos = await dados.mdfeAbertos()
    expect(abertos.map((d) => [d.id, d.viagemId, d.viagemEncerrada]).sort()).toEqual([
      [d1.id, v.id, false],
      [d2.id, null, false],
    ])
    expect(abertos[0]).toMatchObject({ numero: 77, emitidoEm: '2026-10-10' })
    await db.update(s.viagens).set({ status: 'encerrada', fim: '2026-10-12', kmFinal: 101000 }).where(eq(s.viagens.id, v.id))
    await importarArquivos([arquivo('e.xml', ENCERRAMENTO(m2))], null, 'admin:1')
    abertos = await dados.mdfeAbertos()
    expect(abertos.map((d) => [d.id, d.viagemEncerrada])).toEqual([[d1.id, true]])
  })
})
