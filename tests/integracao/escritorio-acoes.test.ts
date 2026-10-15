import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db, schema as s } from '@/db'
import * as acoes from '@/app/admin/actions'
import { config } from '@/lib/dados'
import { hashToken } from '@/lib/acesso'
import { entrarComo, base, criarAdmin, entrarComoAdmin, executar, formulario, limpar } from './banco'

beforeEach(limpar)

/** Lê uma linha pelo id, já tipada pela tabela. */
const linha = {
  motoristas: async (id: number) => (await db.select().from(s.motoristas).where(eq(s.motoristas.id, id)))[0],
  caminhoes: async (id: number) => (await db.select().from(s.caminhoes).where(eq(s.caminhoes.id, id)))[0],
  viagens: async (id: number) => (await db.select().from(s.viagens).where(eq(s.viagens.id, id)))[0],
  despesas: async (id: number) => (await db.select().from(s.despesas).where(eq(s.despesas.id, id)))[0],
  pneus: async (id: number) => (await db.select().from(s.pneus).where(eq(s.pneus.id, id)))[0],
}
const foto = async () =>
  (
    await db
      .insert(s.fotos)
      .values({ dados: Buffer.from([1, 2, 3]), mime: 'image/jpeg', tamanho: 3 })
      .returning()
  )[0]
const despesa = async (viagemId: number, extra: Partial<typeof s.despesas.$inferInsert> = {}) =>
  (
    await db
      .insert(s.despesas)
      .values({ viagemId, tipo: 'Pedágio', valor: 4590, data: '2026-10-11', ...extra })
      .returning()
  )[0]

const MOTORISTA = { nome: 'João da Silva', telefone: '(66) 98888-7777', pin: '4826', comissaoPct: '10', caminhaoId: '', ativo: '1' }

describe('sem sessão de escritório, as ações recusam', () => {
  it('sem sessão nenhuma: volta para /entrar e não grava', async () => {
    const { v } = await base()
    const d = await despesa(v.id)
    expect(await executar(() => acoes.aprovarDespesa(d.id, '/admin'))).toEqual({ redirect: '/entrar' })
    expect(await executar(() => acoes.salvarMotorista(null, '/admin/motoristas', undefined, formulario(MOTORISTA)))).toEqual({ redirect: '/entrar' })
    expect(await executar(() => acoes.excluirViagem(v.id))).toEqual({ redirect: '/entrar' })
    expect(await executar(() => acoes.marcarPago(1, '2026-10', 100, '/admin'))).toEqual({ redirect: '/entrar' })
    expect((await linha.despesas(d.id)).status).toBe('pendente')
    expect(await db.select().from(s.viagens)).toHaveLength(1)
    expect(await db.select().from(s.motoristas)).toHaveLength(1)
  })

  it('sessão de motorista não serve para o escritório', async () => {
    const { mot, v } = await base()
    const d = await despesa(v.id)
    await entrarComo(mot)
    expect(await executar(() => acoes.aprovarDespesa(d.id, '/admin'))).toEqual({ redirect: '/entrar' })
    expect(await executar(() => acoes.gerarLinkAcesso(mot.id))).toEqual({ redirect: '/entrar' })
    expect((await linha.despesas(d.id)).status).toBe('pendente')
  })

  it('administrador desconectado (versão da sessão trocada) ou removido é barrado', async () => {
    const a = await entrarComoAdmin()
    await db.update(s.administradores).set({ versaoSessao: 2 }).where(eq(s.administradores.id, a.id))
    expect(await executar(() => acoes.restaurarAlertas('/admin'))).toEqual({ redirect: '/entrar?saiu=1' })
    await db.delete(s.administradores)
    expect(await executar(() => acoes.restaurarAlertas('/admin'))).toEqual({ redirect: '/entrar?saiu=1' })
  })
})

describe('aprovação de gastos', () => {
  it('aprovar muda o status, limpa o motivo antigo e registra quem aprovou', async () => {
    const { v } = await base()
    const a = await entrarComoAdmin()
    const d = await despesa(v.id, { status: 'recusada', motivoRecusa: 'sem nota' })
    expect(await executar(() => acoes.aprovarDespesa(d.id, '/admin/aprovacoes'))).toEqual({ redirect: '/admin/aprovacoes?ok=Despesa aprovada' })
    expect(await linha.despesas(d.id)).toMatchObject({ status: 'aprovada', motivoRecusa: null })
    const [log] = await db.select().from(s.auditoria).where(eq(s.auditoria.acao, 'aprovou'))
    expect(log).toMatchObject({ autor: `admin:${a.id}`, entidade: 'despesa', entidadeId: String(d.id) })
  })

  it('recusar grava o motivo (cortado em 200) e motivo vazio vira nulo', async () => {
    const { v } = await base()
    await entrarComoAdmin()
    const d = await despesa(v.id)
    const r = await executar(() => acoes.recusarDespesa(d.id, '/admin?mes=2026-10', formulario({ motivo: `  ${'x'.repeat(300)}  ` })))
    expect(r).toEqual({ redirect: '/admin?mes=2026-10&ok=Despesa recusada' })
    const x = await linha.despesas(d.id)
    expect(x.status).toBe('recusada')
    expect(x.motivoRecusa).toHaveLength(200)
    await executar(() => acoes.recusarDespesa(d.id, '/admin', formulario({ motivo: '   ' })))
    expect((await linha.despesas(d.id)).motivoRecusa).toBeNull()
  })

  it('aprovar em lote só mexe nos pendentes (não "desrecusa" um gasto recusado)', async () => {
    const { v } = await base()
    await entrarComoAdmin()
    const p1 = await despesa(v.id)
    const p2 = await despesa(v.id)
    const rec = await despesa(v.id, { status: 'recusada', motivoRecusa: 'duplicado' })
    expect(await executar(() => acoes.aprovarVarias([p1.id, p2.id, rec.id], '/admin'))).toEqual({ redirect: '/admin?ok=3 despesas aprovadas' })
    expect((await linha.despesas(p1.id)).status).toBe('aprovada')
    expect((await linha.despesas(p2.id)).status).toBe('aprovada')
    expect(await linha.despesas(rec.id)).toMatchObject({ status: 'recusada', motivoRecusa: 'duplicado' })
    expect(await executar(() => acoes.aprovarVarias([p1.id], '/admin'))).toEqual({ redirect: '/admin?ok=Despesa aprovada' })
  })
})

describe('cadastro de motoristas', () => {
  it('cadastra com telefone só em dígitos, PIN com hash, e manda gerar o link de acesso', async () => {
    const { cam } = await base()
    await entrarComoAdmin()
    const r = await executar(() =>
      acoes.salvarMotorista(null, '/admin/motoristas', undefined, formulario({ ...MOTORISTA, caminhaoId: String(cam.id), cnhAte: '2027-05-01' })),
    )
    const [m] = await db.select().from(s.motoristas).where(eq(s.motoristas.telefone, '66988887777'))
    expect(r).toEqual({ redirect: `/admin/motoristas?ok=Motorista cadastrado. Envie o link de acesso pelo WhatsApp.&acesso=${m.id}` })
    expect(m).toMatchObject({ nome: 'João da Silva', comissaoPct: 10, caminhaoId: cam.id, cnhAte: '2027-05-01', toxicologicoAte: null, ativo: true })
    expect(await bcrypt.compare('4826', m.pinHash)).toBe(true)
  })

  it('valida celular, comissão entre 0 e 50 e PIN de 4 números', async () => {
    await entrarComoAdmin()
    const salvar = (extra: Record<string, string>) => acoes.salvarMotorista(null, '/admin/motoristas', undefined, formulario({ ...MOTORISTA, ...extra }))
    expect(await salvar({ telefone: '9999-1234' })).toEqual({ erro: 'Celular inválido: use DDD + número.' })
    expect(await salvar({ telefone: '(66) 99999-00001' })).toEqual({ erro: 'Celular inválido: use DDD + número.' })
    expect(await salvar({ comissaoPct: '51' })).toEqual({ erro: 'A comissão precisa ficar entre 0 e 50%.' })
    expect(await salvar({ pin: '123' })).toEqual({ erro: 'O PIN precisa ter 4 números.' })
    expect(await salvar({ pin: '' })).toEqual({ erro: 'O PIN precisa ter 4 números.' })
    expect(await salvar({ nome: '' })).toEqual({ erro: 'Preencha "Nome completo".' })
    expect(await salvar({ caminhaoId: '999' })).toEqual({ erro: 'Escolha uma opção em "Caminhão".' })
    expect(await salvar({ cnhAte: '01/05/2027' })).toEqual({ erro: 'Data inválida em "Validade da CNH".' })
    expect(await db.select().from(s.motoristas)).toHaveLength(0)
    expect(await executar(() => salvar({ comissaoPct: '0' }))).toHaveProperty('redirect')
  })

  it('celular repetido é recusado com mensagem clara', async () => {
    await base()
    await entrarComoAdmin()
    const r = await acoes.salvarMotorista(null, '/admin/motoristas', undefined, formulario({ ...MOTORISTA, telefone: '66900000001' }))
    expect(r).toEqual({ erro: 'Já existe um motorista com este celular.' })
    expect(await db.select().from(s.motoristas)).toHaveLength(1)
  })

  it('editar sem PIN mantém o PIN; desativar derruba as sessões do motorista', async () => {
    const { mot } = await base()
    await entrarComoAdmin()
    const r = await executar(() =>
      acoes.salvarMotorista(mot.id, '/admin/motoristas', undefined, formulario({ ...MOTORISTA, telefone: '66900000001', pin: '', ativo: '' })),
    )
    expect(r).toEqual({ redirect: '/admin/motoristas?ok=Alterações salvas' })
    const x = await linha.motoristas(mot.id)
    expect(x).toMatchObject({ nome: 'João da Silva', ativo: false, versaoSessao: mot.versaoSessao + 1 })
    expect(x.pinHash).toBe(mot.pinHash)
    const [log] = await db.select().from(s.auditoria).where(eq(s.auditoria.acao, 'alterou'))
    expect(log.dados).not.toHaveProperty('pinHash')
  })

  it('editar com PIN novo troca o PIN e não desconecta quem segue ativo', async () => {
    const { mot } = await base()
    await entrarComoAdmin()
    await executar(() => acoes.salvarMotorista(mot.id, '/x', undefined, formulario({ ...MOTORISTA, pin: '9182' })))
    const x = await linha.motoristas(mot.id)
    expect(await bcrypt.compare('9182', x.pinHash)).toBe(true)
    expect(x.versaoSessao).toBe(mot.versaoSessao)
    const [log] = await db.select().from(s.auditoria).where(eq(s.auditoria.acao, 'alterou'))
    expect(log.dados).toMatchObject({ pinHash: 'alterado' })
  })

  it('excluir: só quem não tem viagens; quem tem recebe orientação para desativar', async () => {
    const { mot } = await base()
    await entrarComoAdmin()
    expect(await acoes.excluirMotorista(mot.id, '/admin/motoristas')).toEqual({
      erro: 'Este motorista tem viagens lançadas. Para tirar o acesso, marque como inativo.',
    })
    const [novo] = await db.insert(s.motoristas).values({ nome: 'Sem viagem', telefone: '66900000005', pinHash: 'x' }).returning()
    expect(await executar(() => acoes.excluirMotorista(novo.id, '/admin/motoristas'))).toEqual({ redirect: '/admin/motoristas?ok=Motorista excluído' })
    expect(await db.select().from(s.motoristas)).toHaveLength(1)
  })

  it('excluir motorista com acerto pago cai na trava de chave estrangeira com mensagem amigável', async () => {
    await entrarComoAdmin()
    const [m] = await db.insert(s.motoristas).values({ nome: 'Pago', telefone: '66900000006', pinHash: 'x' }).returning()
    await db.insert(s.acertos).values({ motoristaId: m.id, mes: '2026-09', valor: 100 })
    expect(await acoes.excluirMotorista(m.id, '/x')).toEqual({ erro: 'Não é possível excluir: há registros ligados a este cadastro.' })
  })

  it('gerar link de acesso: cria token (guardado só o hash) e recusa motorista inativo', async () => {
    const { mot } = await base()
    await entrarComoAdmin()
    const r = await acoes.gerarLinkAcesso(mot.id)
    expect(r.link).toMatch(/^http:\/\/localhost:3000\/acesso\/[\w-]{24}$/)
    const token = r.link!.split('/').at(-1)!
    const [l] = await db.select().from(s.linksAcesso)
    expect(l).toMatchObject({ motoristaId: mot.id, tokenHash: hashToken(token) })
    expect(l.tokenHash).not.toContain(token)
    await db.update(s.motoristas).set({ ativo: false }).where(eq(s.motoristas.id, mot.id))
    expect(await acoes.gerarLinkAcesso(mot.id)).toEqual({ erro: 'Motorista inativo.' })
  })

  it('desconectar aumenta a versão da sessão e apaga os links de acesso', async () => {
    const { mot } = await base()
    await entrarComoAdmin()
    await acoes.gerarLinkAcesso(mot.id)
    expect(await executar(() => acoes.desconectarMotorista(mot.id, '/admin/motoristas'))).toEqual({
      redirect: '/admin/motoristas?ok=Motorista desconectado de todos os aparelhos',
    })
    expect((await linha.motoristas(mot.id)).versaoSessao).toBe(mot.versaoSessao + 1)
    expect(await db.select().from(s.linksAcesso)).toHaveLength(0)
  })
})

describe('caminhões', () => {
  const CAMINHAO = { placa: 'abc-1d23', placaCarreta: 'def 4567', descricao: 'Volvo FH 540', km: '250.000', metaConsumo: '2,3', ativo: '1' }

  it('cadastra com placa normalizada e já cria os 22 pneus novos', async () => {
    await entrarComoAdmin()
    expect(await executar(() => acoes.salvarCaminhao(null, '/admin/frota', undefined, formulario(CAMINHAO)))).toEqual({
      redirect: '/admin/frota?ok=Caminhão cadastrado',
    })
    const [c] = await db.select().from(s.caminhoes)
    expect(c).toMatchObject({ placa: 'ABC1D23', placaCarreta: 'DEF4567', km: 250000, metaConsumo: 2.3, ano: null, ativo: true })
    const ps = await db.select().from(s.pneus).where(eq(s.pneus.caminhaoId, c.id))
    expect(ps).toHaveLength(22)
    expect(ps.every((p) => p.sulco === 16 && p.recapagens === 0)).toBe(true)
  })

  it('placa inválida ou repetida é recusada', async () => {
    await base()
    await entrarComoAdmin()
    expect(await acoes.salvarCaminhao(null, '/x', undefined, formulario({ ...CAMINHAO, placa: 'AB12345' }))).toEqual({
      erro: 'Placa inválida. Use o formato ABC1D23 ou ABC1234.',
    })
    expect(await acoes.salvarCaminhao(null, '/x', undefined, formulario({ ...CAMINHAO, placa: 'RKT-4E21' }))).toEqual({
      erro: 'Já existe um caminhão com esta placa.',
    })
    expect(await db.select().from(s.caminhoes)).toHaveLength(1)
  })

  it('editar altera os dados sem recriar pneus', async () => {
    const { cam } = await base()
    await entrarComoAdmin()
    await executar(() => acoes.salvarCaminhao(cam.id, '/x', undefined, formulario({ ...CAMINHAO, placa: 'RKT4E21', ano: '2021', ativo: '' })))
    expect(await linha.caminhoes(cam.id)).toMatchObject({ descricao: 'Volvo FH 540', ano: 2021, ativo: false })
    expect(await db.select().from(s.pneus)).toHaveLength(0)
  })

  it('excluir: recusa com viagens; sem viagens tira dos motoristas e apaga manutenções e pneus', async () => {
    const { cam } = await base()
    await entrarComoAdmin()
    expect(await acoes.excluirCaminhao(cam.id, '/x')).toMatchObject({ erro: expect.stringContaining('tem viagens lançadas') })
    await executar(() => acoes.salvarCaminhao(null, '/x', undefined, formulario({ ...CAMINHAO, placa: 'XYZ9A99' })))
    const [c2] = await db.select().from(s.caminhoes).where(eq(s.caminhoes.placa, 'XYZ9A99'))
    const [m2] = await db.insert(s.motoristas).values({ nome: 'M2', telefone: '66900000003', pinHash: 'x', caminhaoId: c2.id }).returning()
    await db.insert(s.manutencoes).values({ caminhaoId: c2.id, data: '2026-10-01', tipo: 'Preventiva', descricao: 'óleo', valor: 50000 })
    expect(await executar(() => acoes.excluirCaminhao(c2.id, '/admin/frota'))).toEqual({ redirect: '/admin/frota?ok=Caminhão excluído' })
    expect(await db.select().from(s.caminhoes)).toHaveLength(1)
    expect((await linha.motoristas(m2.id)).caminhaoId).toBeNull()
    expect(await db.select().from(s.manutencoes)).toHaveLength(0)
    expect(await db.select().from(s.pneus)).toHaveLength(0)
  })
})

describe('viagens pelo escritório', () => {
  const VIAGEM = (motoristaId: number, caminhaoId: number, extra: Record<string, string> = {}) =>
    formulario({
      motoristaId: String(motoristaId),
      caminhaoId: String(caminhaoId),
      origem: 'Sinop/MT',
      destino: 'Santos/SP',
      carga: 'Soja',
      frete: '15.000,00',
      inicio: '2026-10-01',
      kmInicial: '99000',
      status: 'encerrada',
      fim: '2026-10-05',
      kmFinal: '101.200',
      kmVazio: '200',
      ...extra,
    })

  it('cria viagem encerrada com a comissão do motorista e sobe o km do caminhão', async () => {
    const { mot, cam } = await base()
    await entrarComoAdmin()
    const r = await executar(() => acoes.salvarViagem(null, '#nova', undefined, VIAGEM(mot.id, cam.id, { adiantamento: '500' })))
    const [v] = await db.select().from(s.viagens).where(eq(s.viagens.origem, 'Sinop/MT'))
    expect(r).toEqual({ redirect: `/admin/viagens/${v.id}?ok=Viagem criada` })
    expect(v).toMatchObject({ frete: 1500000, adiantamento: 50000, comissaoPct: 12, kmFinal: 101200, kmVazio: 200, fim: '2026-10-05', status: 'encerrada' })
    expect((await linha.caminhoes(cam.id)).km).toBe(101200)
  })

  it('km do caminhão nunca desce por causa de uma viagem antiga', async () => {
    const { mot, cam } = await base()
    await db.update(s.caminhoes).set({ km: 300000 }).where(eq(s.caminhoes.id, cam.id))
    await entrarComoAdmin()
    await executar(() => acoes.salvarViagem(null, '/x', undefined, VIAGEM(mot.id, cam.id)))
    expect((await linha.caminhoes(cam.id)).km).toBe(300000)
  })

  it('valida chegada, km final, km vazio e comissão de viagem encerrada', async () => {
    const { mot, cam } = await base()
    await entrarComoAdmin()
    const t = (extra: Record<string, string>) => acoes.salvarViagem(null, '/x', undefined, VIAGEM(mot.id, cam.id, extra))
    expect(await t({ fim: '' })).toEqual({ erro: 'Informe a data de chegada.' })
    expect(await t({ fim: '2026-09-30' })).toEqual({ erro: 'A chegada não pode ser antes do início.' })
    expect(await t({ kmFinal: '99000' })).toEqual({ erro: 'O km final precisa ser maior que o km inicial.' })
    expect(await t({ kmVazio: '2200' })).toEqual({ erro: 'O km vazio precisa ser menor que o total rodado.' })
    expect(await t({ comissaoPct: '60' })).toEqual({ erro: 'A comissão precisa ficar entre 0 e 50%.' })
    expect(await t({ motoristaId: '999' })).toEqual({ erro: 'Escolha uma opção em "Motorista".' })
    expect(await db.select().from(s.viagens)).toHaveLength(1)
  })

  it('segunda viagem em andamento para o mesmo motorista é recusada', async () => {
    const { mot, cam } = await base()
    await entrarComoAdmin()
    const r = await acoes.salvarViagem(null, '/x', undefined, VIAGEM(mot.id, cam.id, { status: 'andamento' }))
    expect(r).toEqual({ erro: 'Este motorista já tem outra viagem em andamento.' })
  })

  it('editar: viagem em andamento zera chegada e km final; comissão informada vale para a viagem', async () => {
    const { mot, cam, v } = await base()
    await entrarComoAdmin()
    await db.update(s.viagens).set({ status: 'encerrada', fim: '2026-10-12', kmFinal: 101000 }).where(eq(s.viagens.id, v.id))
    const r = await executar(() => acoes.salvarViagem(v.id, '/admin/viagens', undefined, VIAGEM(mot.id, cam.id, { status: 'andamento', comissaoPct: '15' })))
    expect(r).toEqual({ redirect: '/admin/viagens?ok=Viagem salva' })
    expect(await linha.viagens(v.id)).toMatchObject({ status: 'andamento', fim: null, kmFinal: null, comissaoPct: 15, origem: 'Sinop/MT' })
  })

  it('excluir viagem apaga os gastos e as fotos dos comprovantes', async () => {
    const { v } = await base()
    await entrarComoAdmin()
    const f1 = await foto()
    const f2 = await foto()
    const outra = await foto() // de ninguém desta viagem: fica
    await despesa(v.id, { fotoId: f1.id })
    await despesa(v.id, { fotoId: f2.id })
    await despesa(v.id)
    expect(await executar(() => acoes.excluirViagem(v.id))).toEqual({ redirect: `/admin/viagens?ok=Viagem ${v.id} excluída` })
    expect(await db.select().from(s.viagens)).toHaveLength(0)
    expect(await db.select().from(s.despesas)).toHaveLength(0)
    expect((await db.select().from(s.fotos)).map((x) => x.id)).toEqual([outra.id])
    const [log] = await db.select().from(s.auditoria).where(eq(s.auditoria.acao, 'excluiu'))
    expect(log.dados).toMatchObject({ id: v.id, origem: 'Rondonópolis/MT' })
  })
})

describe('gastos lançados pelo escritório', () => {
  const GASTO = { tipo: 'Diesel', valor: '1.000,00', litros: '180', data: '2026-10-11', pagoPor: 'motorista', status: 'aprovada' }

  it('lança e edita; diesel exige litros e outros tipos não guardam litros', async () => {
    const { v } = await base()
    await entrarComoAdmin()
    expect(await acoes.salvarDespesa(null, v.id, '/x', undefined, formulario({ ...GASTO, litros: '' }))).toEqual({
      erro: 'Informe os litros do abastecimento.',
    })
    expect(await acoes.salvarDespesa(null, v.id, '/x', undefined, formulario({ ...GASTO, valor: '0' }))).toEqual({ erro: 'Informe o valor.' })
    expect(await executar(() => acoes.salvarDespesa(null, v.id, '/x', undefined, formulario(GASTO)))).toEqual({ redirect: '/x?ok=Despesa salva' })
    const [d] = await db.select().from(s.despesas)
    expect(d).toMatchObject({ viagemId: v.id, valor: 100000, litros: 180, pagoPor: 'motorista', status: 'aprovada' })
    await executar(() => acoes.salvarDespesa(d.id, v.id, '/x', undefined, formulario({ ...GASTO, tipo: 'Pedágio', obs: 'praça 3' })))
    expect(await linha.despesas(d.id)).toMatchObject({ tipo: 'Pedágio', litros: null, obs: 'praça 3' })
  })

  it('excluir gasto apaga a foto do comprovante', async () => {
    const { v } = await base()
    await entrarComoAdmin()
    const f = await foto()
    const d = await despesa(v.id, { fotoId: f.id })
    expect(await executar(() => acoes.excluirDespesa(d.id, '/x'))).toEqual({ redirect: '/x?ok=Despesa excluída' })
    expect(await db.select().from(s.despesas)).toHaveLength(0)
    expect(await db.select().from(s.fotos)).toHaveLength(0)
  })
})

describe('manutenção, pneus, seguros, custos fixos e lembretes', () => {
  it('manutenção: cria, altera e exclui', async () => {
    const { cam } = await base()
    await entrarComoAdmin()
    const f = { caminhaoId: String(cam.id), data: '2026-10-02', tipo: 'Corretiva', valor: '850,00', descricao: 'Embreagem', imprevisto: '1' }
    await executar(() => acoes.salvarManutencao(null, '/x', undefined, formulario(f)))
    const [m] = await db.select().from(s.manutencoes)
    expect(m).toMatchObject({ valor: 85000, imprevisto: true, tipo: 'Corretiva' })
    await executar(() => acoes.salvarManutencao(m.id, '/x', undefined, formulario({ ...f, valor: '900' })))
    expect((await db.select().from(s.manutencoes))[0].valor).toBe(90000)
    expect(await executar(() => acoes.excluirManutencao(m.id, '/x'))).toEqual({ redirect: '/x?ok=Manutenção excluída' })
    expect(await db.select().from(s.manutencoes)).toHaveLength(0)
  })

  it('pneu: limita o sulco; trocar zera e recapar soma custo e recapagem', async () => {
    const { cam } = await base()
    await entrarComoAdmin()
    const [p] = await db
      .insert(s.pneus)
      .values({ caminhaoId: cam.id, posicao: 1, eixo: 'Direcional', lado: 'Esquerdo', sulco: 5, recapagens: 1, km: 80000, custo: 300000 })
      .returning()
    expect(await acoes.salvarPneu(p.id, '/x', undefined, formulario({ sulco: '30', recapagens: '1', km: '1', custo: '1' }))).toEqual({
      erro: 'Sulco acima do possível. Confira o valor em milímetros.',
    })
    await executar(() => acoes.salvarPneu(p.id, '/x', undefined, formulario({ sulco: '4,5', recapagens: '1', km: '85000', custo: '3.000,00' })))
    expect(await linha.pneus(p.id)).toMatchObject({ sulco: 4.5, km: 85000, custo: 300000 })
    expect(await executar(() => acoes.trocarPneu(p.id, '/x', formulario({ modo: 'recapar' })))).toEqual({ redirect: '/x?ok=Recapagem registrada' })
    expect(await linha.pneus(p.id)).toMatchObject({ sulco: 12, recapagens: 2, custo: 378000, km: 85000 })
    expect(await executar(() => acoes.trocarPneu(p.id, '/x', formulario({ modo: 'novo' })))).toEqual({ redirect: '/x?ok=Pneu novo registrado' })
    expect(await linha.pneus(p.id)).toMatchObject({ sulco: 16, recapagens: 0, km: 0, custo: 290000 })
  })

  it('apólice, custo fixo e lembrete: cria, altera e exclui', async () => {
    await entrarComoAdmin()
    await executar(() =>
      acoes.salvarApolice(
        null,
        '/x',
        undefined,
        formulario({ nome: 'RCTR-C', cobertura: 'Carga', vigenciaAte: '2027-01-01', custoMensal: '450', obrigatorio: '1' }),
      ),
    )
    const [ap] = await db.select().from(s.apolices)
    expect(ap).toMatchObject({ custoMensal: 45000, obrigatorio: true })
    await executar(() => acoes.salvarApolice(ap.id, '/x', undefined, formulario({ nome: 'RCTR-C', cobertura: 'Carga total', custoMensal: '500' })))
    expect((await db.select().from(s.apolices))[0]).toMatchObject({ cobertura: 'Carga total', vigenciaAte: null, obrigatorio: false })
    await executar(() => acoes.excluirApolice(ap.id, '/x'))
    expect(await db.select().from(s.apolices)).toHaveLength(0)

    await executar(() => acoes.salvarFixo(null, '/x', undefined, formulario({ nome: 'Rastreador', valorMensal: '189,90' })))
    const [fx] = await db.select().from(s.custosFixos)
    expect(fx.valorMensal).toBe(18990)
    await executar(() => acoes.salvarFixo(fx.id, '/x', undefined, formulario({ nome: 'Rastreador', valorMensal: '200' })))
    expect((await db.select().from(s.custosFixos))[0].valorMensal).toBe(20000)
    await executar(() => acoes.excluirFixo(fx.id, '/x'))
    expect(await db.select().from(s.custosFixos)).toHaveLength(0)

    await executar(() => acoes.salvarLembrete(null, '/x', undefined, formulario({ texto: 'Renovar ANTT', data: '2026-12-01' })))
    const [l] = await db.select().from(s.lembretes)
    await executar(() => acoes.salvarLembrete(l.id, '/x', undefined, formulario({ texto: 'Renovar RNTRC', data: '2026-12-01' })))
    expect((await db.select().from(s.lembretes))[0].texto).toBe('Renovar RNTRC')
    expect(await executar(() => acoes.excluirLembrete(l.id, '/x'))).toEqual({ redirect: '/x?ok=Lembrete excluído' })
    expect(await db.select().from(s.lembretes)).toHaveLength(0)
  })

  it('alertas: dispensar (sem duplicar) e restaurar', async () => {
    await entrarComoAdmin()
    await executar(() => acoes.dispensarAlerta('cnh:1', '/admin'))
    expect(await executar(() => acoes.dispensarAlerta('cnh:1', '/admin'))).toEqual({ redirect: '/admin?ok=Alerta dispensado' })
    expect(await db.select().from(s.alertasDispensados)).toHaveLength(1)
    expect(await executar(() => acoes.restaurarAlertas('/admin'))).toEqual({ redirect: '/admin?ok=Alertas restaurados' })
    expect(await db.select().from(s.alertasDispensados)).toHaveLength(0)
  })
})

describe('configurações e acessos do escritório', () => {
  const CFG = { diasAviso: '45', diasUrgente: '15', kmAvisoRevisao: '3000', sulcoMinimo: '3,5', retornoPct: '50', nomeEmpresa: '  ', whatsappEscritorio: '' }

  it('salva configurações válidas (nome vazio vira padrão) e só volta para páginas do /admin', async () => {
    await config()
    await entrarComoAdmin()
    const r = await executar(() => acoes.salvarConfig(undefined, formulario({ ...CFG, voltar: 'https://golpe.example' })))
    expect(r).toEqual({ redirect: '/admin/config?ok=Configurações salvas' })
    expect(await config()).toMatchObject({
      diasAviso: 45,
      diasUrgente: 15,
      sulcoMinimo: 3.5,
      retornoPct: 50,
      nomeEmpresa: 'Empresa FG',
      whatsappEscritorio: null,
    })
    expect(await executar(() => acoes.salvarConfig(undefined, formulario({ ...CFG, voltar: '/admin/alertas' })))).toEqual({
      redirect: '/admin/alertas?ok=Configurações salvas',
    })
  })

  it('recusa valores fora da faixa, urgente maior que aviso e WhatsApp curto', async () => {
    await config()
    await entrarComoAdmin()
    const t = (extra: Record<string, string>) => acoes.salvarConfig(undefined, formulario({ ...CFG, ...extra }))
    expect(await t({ diasAviso: '0' })).toEqual({ erro: 'Valor inválido em "Avisar com quantos dias".' })
    expect(await t({ sulcoMinimo: '1' })).toEqual({ erro: 'Valor inválido em "Sulco mínimo".' })
    expect(await t({ retornoPct: 'abc' })).toEqual({ erro: 'Valor inválido em "Frete de retorno".' })
    expect(await t({ diasUrgente: '50' })).toEqual({ erro: 'O prazo urgente precisa ser menor ou igual ao prazo de aviso.' })
    expect(await t({ whatsappEscritorio: '9999' })).toEqual({ erro: 'WhatsApp do escritório: use DDD + número.' })
    expect((await config()).diasAviso).toBe(60)
  })

  it('trocar senha confere a atual, exige 8 caracteres e confirmação', async () => {
    const a = await entrarComoAdmin()
    expect(await acoes.trocarSenha(undefined, formulario({ atual: 'errada', nova: 'nova-senha-1', confirma: 'nova-senha-1' }))).toEqual({
      erro: 'A senha atual não confere.',
    })
    expect(await acoes.trocarSenha(undefined, formulario({ atual: 'senha-forte-1', nova: 'curta', confirma: 'curta' }))).toEqual({
      erro: 'A nova senha precisa ter pelo menos 8 caracteres.',
    })
    expect(await acoes.trocarSenha(undefined, formulario({ atual: 'senha-forte-1', nova: 'nova-senha-1', confirma: 'outra' }))).toEqual({
      erro: 'A confirmação não bate com a nova senha.',
    })
    expect(await executar(() => acoes.trocarSenha(undefined, formulario({ atual: 'senha-forte-1', nova: 'nova-senha-1', confirma: 'nova-senha-1' })))).toEqual({
      redirect: '/admin/config?ok=Senha alterada',
    })
    const [x] = await db.select().from(s.administradores).where(eq(s.administradores.id, a.id))
    expect(await bcrypt.compare('nova-senha-1', x.senhaHash)).toBe(true)
  })

  it('novo acesso: valida usuário e senha, não repete usuário e grava senha com hash', async () => {
    await entrarComoAdmin()
    const t = (extra: Record<string, string>) =>
      acoes.novoAdmin(undefined, formulario({ nome: 'Maria', usuario: 'Maria.Silva', senha: 'segredo-123', ...extra }))
    expect(await t({ usuario: 'com espaço' })).toMatchObject({ erro: expect.stringContaining('usuário sem espaços') })
    expect(await t({ senha: '1234567' })).toEqual({ erro: 'A senha precisa ter pelo menos 8 caracteres.' })
    expect(await t({ usuario: 'escritorio' })).toEqual({ erro: 'Este usuário já existe.' })
    expect(await executar(() => t({}))).toEqual({ redirect: '/admin/config?ok=Acesso criado para Maria' })
    const [m] = await db.select().from(s.administradores).where(eq(s.administradores.usuario, 'maria.silva'))
    expect(await bcrypt.compare('segredo-123', m.senhaHash)).toBe(true)
  })

  it('remover acesso: não remove o próprio, remove outro', async () => {
    const a = await entrarComoAdmin()
    const b = await criarAdmin('outro')
    expect(await executar(() => acoes.removerAdmin(a.id))).toEqual({ redirect: '/admin/config?erro=Você não pode remover o próprio acesso.' })
    expect(await executar(() => acoes.removerAdmin(b.id))).toEqual({ redirect: '/admin/config?ok=Acesso removido' })
    expect((await db.select().from(s.administradores)).map((x) => x.id)).toEqual([a.id])
  })
})

describe('acerto (fechamento do mês)', () => {
  it('marcar pago grava; marcar de novo atualiza o valor sem duplicar; desfazer apaga', async () => {
    const { mot } = await base()
    const a = await entrarComoAdmin()
    expect(await executar(() => acoes.marcarPago(mot.id, '2026-10', 250000, '/admin/acerto?mes=2026-10'))).toEqual({
      redirect: '/admin/acerto?mes=2026-10&ok=Acerto marcado como pago',
    })
    await executar(() => acoes.marcarPago(mot.id, '2026-10', 260000, '/x'))
    const acs = await db.select().from(s.acertos)
    expect(acs).toHaveLength(1)
    expect(acs[0]).toMatchObject({ motoristaId: mot.id, mes: '2026-10', valor: 260000 })
    const [log] = await db.select().from(s.auditoria).where(eq(s.auditoria.entidade, 'acerto'))
    expect(log).toMatchObject({ autor: `admin:${a.id}`, entidadeId: `${mot.id}/2026-10` })
    expect(await executar(() => acoes.desfazerPago(mot.id, '2026-10', '/x'))).toEqual({ redirect: '/x?ok=Pagamento desfeito' })
    expect(await db.select().from(s.acertos)).toHaveLength(0)
  })
})
