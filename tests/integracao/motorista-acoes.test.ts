import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db, schema as s } from '@/db'
import { encerrarViagem, iniciarViagem, trocarPin } from '@/app/m/actions'
import { hoje, somaDias } from '@/lib/datas'
import { base, entrarComo, executar, formulario, limpar } from './banco'

beforeEach(limpar)

const NOVA = { origem: 'Sorriso/MT', destino: 'Paranaguá/PR', carga: 'Milho', frete: '12.500,00', km: '101.500' }

/** Motorista da base com a viagem já encerrada (pronto para iniciar outra) e o caminhão no km 101.000. */
async function semViagem() {
  const b = await base()
  await db.update(s.viagens).set({ status: 'encerrada', fim: '2026-10-12', kmFinal: 101000 }).where(eq(s.viagens.id, b.v.id))
  await db.update(s.caminhoes).set({ km: 101000 }).where(eq(s.caminhoes.id, b.cam.id))
  await entrarComo(b.mot)
  return b
}
const ativas = (motoristaId: number) =>
  db
    .select()
    .from(s.viagens)
    .where(eq(s.viagens.motoristaId, motoristaId))
    .then((vs) => vs.filter((v) => v.status === 'andamento'))

describe('iniciar viagem pelo celular', () => {
  it('sem sessão manda para o login e não grava nada', async () => {
    await base()
    expect(await executar(() => iniciarViagem(formulario(NOVA)))).toEqual({ redirect: '/entrar' })
    expect(await db.select().from(s.viagens)).toHaveLength(1)
  })

  it('cria a viagem com a comissão do motorista, atualiza o km do caminhão e registra auditoria', async () => {
    const { mot, cam } = await semViagem()
    const r = await executar(() => iniciarViagem(formulario(NOVA)))
    expect(r).toEqual({ redirect: '/m?ok=Viagem iniciada. Boa viagem!' })
    const [v] = await ativas(mot.id)
    expect(v).toMatchObject({
      origem: 'Sorriso/MT',
      destino: 'Paranaguá/PR',
      carga: 'Milho',
      frete: 1250000,
      comissaoPct: 12,
      kmInicial: 101500,
      inicio: hoje(),
      caminhaoId: cam.id,
    })
    const [c] = await db.select().from(s.caminhoes).where(eq(s.caminhoes.id, cam.id))
    expect(c.km).toBe(101500)
    const [log] = await db.select().from(s.auditoria).where(eq(s.auditoria.acao, 'iniciou'))
    expect(log).toMatchObject({ autor: `motorista:${mot.id}`, entidade: 'viagem', entidadeId: String(v.id) })
  })

  it('não deixa iniciar uma segunda viagem com outra em andamento', async () => {
    const { mot } = await base()
    await entrarComo(mot)
    const r = await executar(() => iniciarViagem(formulario(NOVA)))
    expect(r).toEqual({ erro: 'Você já tem uma viagem em andamento. Encerre antes de iniciar outra.' })
    expect(await ativas(mot.id)).toHaveLength(1)
  })

  it('o índice único do banco segura a corrida de dois envios ao mesmo tempo', async () => {
    const { mot } = await semViagem()
    // allSettled: o envio que perde a corrida hoje estoura erro em vez da mensagem amigável (ver relatório), mas o banco nunca fica com duas.
    const rs = await Promise.allSettled([executar(() => iniciarViagem(formulario(NOVA))), executar(() => iniciarViagem(formulario(NOVA)))])
    expect(rs.filter((r) => r.status === 'fulfilled' && 'redirect' in (r.value ?? {}))).toHaveLength(1)
    expect(await ativas(mot.id)).toHaveLength(1)
  })

  it('motorista sem caminhão no cadastro não inicia', async () => {
    const { mot } = await semViagem()
    await db.update(s.motoristas).set({ caminhaoId: null }).where(eq(s.motoristas.id, mot.id))
    expect(await executar(() => iniciarViagem(formulario(NOVA)))).toEqual({ erro: 'Você está sem caminhão no cadastro. Fale com o escritório.' })
  })

  it('cobra origem, destino e carga, apontando o campo', async () => {
    await semViagem()
    expect(await iniciarViagem(formulario({ ...NOVA, origem: '  ' }))).toMatchObject({ campo: 'origem' })
    expect(await iniciarViagem(formulario({ ...NOVA, destino: '' }))).toMatchObject({ campo: 'destino' })
    expect(await iniciarViagem(formulario({ ...NOVA, carga: '' }))).toMatchObject({ campo: 'carga' })
  })

  it('frete: obrigatório e positivo, a não ser que marque "não sei"', async () => {
    const { mot } = await semViagem()
    const erro = { erro: 'Digite o valor do frete ou marque que não sabe.', campo: 'frete' }
    expect(await iniciarViagem(formulario({ ...NOVA, frete: '' }))).toEqual(erro)
    expect(await iniciarViagem(formulario({ ...NOVA, frete: '0' }))).toEqual(erro)
    expect(await iniciarViagem(formulario({ ...NOVA, frete: 'abc' }))).toEqual(erro)
    expect(await ativas(mot.id)).toHaveLength(0)
    await executar(() => iniciarViagem(formulario({ ...NOVA, frete: '', semFrete: '1' })))
    expect((await ativas(mot.id))[0].frete).toBe(0)
  })

  it('km: obrigatório, positivo e não menor que o último km do caminhão', async () => {
    const { mot } = await semViagem()
    expect(await iniciarViagem(formulario({ ...NOVA, km: '' }))).toEqual({ erro: 'Digite o km do caminhão.', campo: 'km' })
    expect(await iniciarViagem(formulario({ ...NOVA, km: '0' }))).toEqual({ erro: 'Digite o km do caminhão.', campo: 'km' })
    expect(await iniciarViagem(formulario({ ...NOVA, km: '100.999' }))).toEqual({
      erro: 'O km não pode ser menor que o último registrado (101.000).',
      campo: 'km',
    })
    expect(await ativas(mot.id)).toHaveLength(0)
  })

  it('textos longos são cortados em 80 caracteres', async () => {
    const { mot } = await semViagem()
    await executar(() => iniciarViagem(formulario({ ...NOVA, carga: 'x'.repeat(200) })))
    expect((await ativas(mot.id))[0].carga).toHaveLength(80)
  })
})

describe('encerrar viagem pelo celular', () => {
  it('grava chegada, km final e km vazio e leva o caminhão para o km final', async () => {
    const { mot, v, cam } = await base()
    await entrarComo(mot)
    const r = await executar(() => encerrarViagem(formulario({ kmFinal: '101.800', voltouVazio: '1', kmVazio: '300', fim: '2026-10-12' })))
    expect(r).toEqual({ redirect: '/m/extrato?ok=Viagem encerrada. Confira seu extrato.' })
    const [x] = await db.select().from(s.viagens).where(eq(s.viagens.id, v.id))
    expect(x).toMatchObject({ status: 'encerrada', fim: '2026-10-12', kmFinal: 101800, kmVazio: 300 })
    expect((await db.select().from(s.caminhoes).where(eq(s.caminhoes.id, cam.id)))[0].km).toBe(101800)
    const [log] = await db.select().from(s.auditoria).where(eq(s.auditoria.acao, 'encerrou'))
    expect(log.autor).toBe(`motorista:${mot.id}`)
  })

  it('sem data informada, a chegada é hoje; km vazio só conta se marcou que voltou vazio', async () => {
    const { mot, v } = await base()
    await entrarComo(mot)
    await executar(() => encerrarViagem(formulario({ kmFinal: '101000', kmVazio: '500' })))
    const [x] = await db.select().from(s.viagens).where(eq(s.viagens.id, v.id))
    expect(x).toMatchObject({ fim: hoje(), kmVazio: 0 })
  })

  it('km final precisa ser maior que o inicial', async () => {
    const { mot, v } = await base()
    await entrarComo(mot)
    const erro = { erro: 'O km final precisa ser maior que o inicial (100.000).', campo: 'kmFinal' }
    expect(await encerrarViagem(formulario({ kmFinal: '100000' }))).toEqual(erro)
    expect(await encerrarViagem(formulario({ kmFinal: '99000' }))).toEqual(erro)
    expect(await encerrarViagem(formulario({ kmFinal: '' }))).toEqual(erro)
    expect((await db.select().from(s.viagens).where(eq(s.viagens.id, v.id)))[0].status).toBe('andamento')
  })

  it('km vazio precisa ser menor que o total rodado', async () => {
    const { mot } = await base()
    await entrarComo(mot)
    expect(await encerrarViagem(formulario({ kmFinal: '101000', voltouVazio: '1', kmVazio: '1000' }))).toMatchObject({ campo: 'kmVazio' })
    expect(await encerrarViagem(formulario({ kmFinal: '101000', voltouVazio: '1', kmVazio: '-5' }))).toMatchObject({ campo: 'kmVazio' })
  })

  it('a chegada não pode ser antes do início nem no futuro', async () => {
    const { mot } = await base()
    await entrarComo(mot)
    expect(await encerrarViagem(formulario({ kmFinal: '101000', fim: '2026-10-09' }))).toEqual({ erro: 'A chegada não pode ser antes do início da viagem.' })
    expect(await encerrarViagem(formulario({ kmFinal: '101000', fim: somaDias(hoje(), 1) }))).toEqual({
      erro: 'A data de chegada não pode ser no futuro.',
    })
  })

  it('só encerra a viagem do próprio motorista: outro motorista sem viagem volta para /m', async () => {
    const { v } = await base()
    const [outro] = await db.insert(s.motoristas).values({ nome: 'Outro', telefone: '66900000002', pinHash: 'x' }).returning()
    await entrarComo(outro)
    expect(await executar(() => encerrarViagem(formulario({ kmFinal: '200000' })))).toEqual({ redirect: '/m' })
    const [x] = await db.select().from(s.viagens).where(eq(s.viagens.id, v.id))
    expect(x).toMatchObject({ status: 'andamento', kmFinal: null })
  })

  it('motorista desativado é desconectado antes de encerrar', async () => {
    const { mot } = await base()
    await entrarComo(mot)
    await db.update(s.motoristas).set({ ativo: false }).where(eq(s.motoristas.id, mot.id))
    expect(await executar(() => encerrarViagem(formulario({ kmFinal: '101000' })))).toEqual({ redirect: '/entrar?saiu=1' })
  })
})

describe('trocar PIN', () => {
  const pinAtual = async (id: number) => (await db.select().from(s.motoristas).where(eq(s.motoristas.id, id)))[0].pinHash

  it('com o PIN atual certo grava o novo (com hash) e registra', async () => {
    const { mot } = await base()
    await entrarComo(mot)
    const r = await executar(() => trocarPin(formulario({ atual: '1234', novo: '5821', confirma: '5821' })))
    expect(r).toEqual({ redirect: '/m/conta?ok=PIN alterado' })
    const h = await pinAtual(mot.id)
    expect(h).not.toContain('5821')
    expect(await bcrypt.compare('5821', h)).toBe(true)
    expect(await db.select().from(s.auditoria).where(eq(s.auditoria.acao, 'trocou o PIN'))).toHaveLength(1)
  })

  it('PIN atual errado não troca', async () => {
    const { mot } = await base()
    await entrarComo(mot)
    expect(await trocarPin(formulario({ atual: '9999', novo: '5821', confirma: '5821' }))).toEqual({ erro: 'O PIN atual não confere.', campo: 'atual' })
    expect(await bcrypt.compare('1234', await pinAtual(mot.id))).toBe(true)
  })

  it('recusa PIN que não tem 4 números, PIN óbvio e confirmação diferente', async () => {
    const { mot } = await base()
    await entrarComo(mot)
    const t = (novo: string, confirma = novo) => trocarPin(formulario({ atual: '1234', novo, confirma }))
    expect(await t('12a4')).toMatchObject({ campo: 'novo', erro: 'O novo PIN precisa ter 4 números.' })
    expect(await t('12345')).toMatchObject({ campo: 'novo' })
    expect(await t('7777')).toEqual({ erro: 'Escolha um PIN menos óbvio.', campo: 'novo' })
    expect(await t('4321')).toEqual({ erro: 'Escolha um PIN menos óbvio.', campo: 'novo' })
    expect(await t('5821', '5822')).toEqual({ erro: 'A confirmação não bate com o novo PIN.', campo: 'confirma' })
    expect(await bcrypt.compare('1234', await pinAtual(mot.id))).toBe(true)
  })

  it('sem sessão de motorista (ex.: sessão de admin) manda para o login', async () => {
    await base()
    expect(await executar(() => trocarPin(formulario({ atual: '1234', novo: '5821', confirma: '5821' })))).toEqual({ redirect: '/entrar' })
  })
})
