// Dados de exemplo, os mesmos do protótipo, com as datas trazidas para perto de hoje.
// Uso: npm run db:seed            (só cria se o banco estiver vazio)
//      npm run db:seed -- --limpar (apaga tudo e recria)
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
// Carrega o .env quando existe (no computador); na Vercel as variáveis já vêm do painel.
try { process.loadEnvFile() } catch {}
import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'
import * as s from '../src/db/schema'
import { hoje, somaDias, dias } from '../src/lib/datas'

const client = postgres(process.env.DATABASE_URL ?? 'postgres://fg:fg@localhost:5432/fg', { max: 1 })
const db = drizzle(client, { schema: s })
const limpar = process.argv.includes('--limpar')

const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.administradores)
if (n > 0 && !limpar) {
  console.log('O banco já tem dados. Use --limpar para apagar e recriar os exemplos.')
  await client.end(); process.exit(0)
}
if (limpar) {
  await db.execute(sql`TRUNCATE administradores, caminhoes, motoristas, viagens, despesas, fotos, manutencoes, pneus, apolices, custos_fixos, lembretes, configuracao, alertas_dispensados, acertos, links_acesso, tentativas_login, auditoria RESTART IDENTITY CASCADE`)
}

const H = hoje()
const desloc = dias('2026-10-06', H) // o protótipo considerava "hoje" = 06/10/2026
const D = (d: string) => somaDias(d, desloc)
const C = (reais: number) => Math.round(reais * 100)
const DIESEL = 6.19

await db.insert(s.configuracao).values({ id: 1, whatsappEscritorio: '66999990000' })
await db.insert(s.administradores).values({ nome: 'Administrador', usuario: 'admin', senhaHash: await bcrypt.hash(process.env.ADMIN_SENHA || 'fg2026', 10) })

const PC = ['RLB8F45', 'QTA3C18', 'SFM6J02', 'PKD1G73']
const cams = await db.insert(s.caminhoes).values([
  { placa: 'RKT4E21', descricao: 'Cavalo 6x4 + graneleira', ano: 2021, km: 404000, metaConsumo: 2.4, proximaRevisaoKm: 420000, tacografoAte: D('2027-04-10'), licenciamentoAte: D('2027-06-30') },
  { placa: 'QPM7B09', descricao: 'Cavalo 6x2 + graneleira', ano: 2019, km: 590000, metaConsumo: 2.5, proximaRevisaoKm: 600000, tacografoAte: D('2027-01-22'), licenciamentoAte: D('2027-07-31') },
  { placa: 'SDA2H56', descricao: 'Cavalo 6x4 + graneleira', ano: 2023, km: 195000, metaConsumo: 2.3, proximaRevisaoKm: 210000, tacografoAte: D('2027-09-05'), licenciamentoAte: D('2027-08-31') },
  { placa: 'OXJ9C37', descricao: 'Cavalo 6x2 + sider', ano: 2017, km: 798000, metaConsumo: 2.5, proximaRevisaoKm: 810000, tacografoAte: D('2026-10-30'), licenciamentoAte: D('2026-11-30') },
].map((c, i) => ({ ...c, placaCarreta: PC[i] }))).returning()

const mots = await db.insert(s.motoristas).values(await Promise.all([
  ['Valdir Nogueira', '66900000001', 10, '2027-03-14', '2026-11-02'],
  ['Jeferson Prado', '64900000002', 10, '2026-10-28', '2028-01-20'],
  ['Edmilson Carvalho', '66900000003', 12, '2029-06-01', '2027-08-15'],
  ['Rogério Batista', '34900000004', 10, '2028-02-09', '2027-04-30'],
].map(async ([nome, tel, com, cnh, tox], i) => ({
  nome: nome as string, telefone: tel as string, comissaoPct: com as number, caminhaoId: cams[i].id,
  cnhAte: D(cnh as string), toxicologicoAte: D(tox as string), pinHash: await bcrypt.hash(String(i + 1).repeat(4), 10),
})))).returning()

const RT: [string, string, number][] = [['Rondonópolis/MT', 'Santos/SP', 1410], ['Sorriso/MT', 'Paranaguá/PR', 2180], ['Rio Verde/GO', 'Santos/SP', 1010], ['Uberlândia/MG', 'Rio de Janeiro/RJ', 990], ['Dourados/MS', 'Paranaguá/PR', 880], ['Santos/SP', 'Rondonópolis/MT', 1410]]
type Raw = [number, number, string, number, string, number, number, number, number, number, number]
const RAW: Raw[] = [
  [1, 0, '2026-09-01', 3, 'Soja 37 t', 13800, 0, 598, 1040, 210, 1500], [1, 5, '2026-09-05', 3, 'Fertilizante 35 t', 9400, 0, 580, 1040, 180, 1000], [1, 1, '2026-09-10', 5, 'Milho 37 t', 21500, 320, 1065, 1380, 340, 2500], [1, 0, '2026-09-19', 3, 'Soja 37 t', 13600, 1410, 1190, 1040, 220, 1500],
  [2, 2, '2026-09-02', 2, 'Soja 32 t', 9800, 1010, 790, 820, 160, 1000], [2, 2, '2026-09-08', 2, 'Milho 32 t', 9500, 1010, 845, 820, 420, 1000], [2, 4, '2026-09-15', 2, 'Soja 32 t', 8200, 640, 600, 610, 140, 800], [2, 2, '2026-09-22', 2, 'Soja 32 t', 9900, 0, 400, 820, 150, 1000],
  [3, 1, '2026-09-03', 5, 'Soja 37 t', 21800, 0, 960, 1380, 300, 2500], [3, 5, '2026-09-11', 3, 'Fertilizante 36 t', 9600, 180, 690, 1040, 200, 1000], [3, 0, '2026-09-16', 3, 'Soja 37 t', 13900, 0, 615, 1040, 190, 1500], [3, 5, '2026-09-22', 3, 'Calcário 36 t', 8900, 0, 612, 1040, 170, 1000],
  [4, 3, '2026-09-04', 2, 'Café 28 t', 8700, 990, 810, 690, 230, 800], [4, 3, '2026-09-12', 2, 'Bebidas 27 t', 8100, 990, 865, 690, 610, 800], [4, 4, '2026-09-21', 2, 'Soja 32 t', 8300, 640, 620, 610, 150, 800],
  [1, 0, '2026-10-01', 3, 'Soja 37 t', 14100, 0, 601, 1040, 205, 1500], [2, 2, '2026-10-02', 2, 'Soja 32 t', 9900, 1010, 800, 820, 150, 1000],
]
const km = new Map(cams.map((c) => [c.id, c.km]))
for (const [dr, ro, ini0, dd, carga, frete, vazio, lit, ped, out, adi] of RAW) {
  const m = mots[dr - 1], cam = cams[dr - 1], r = RT[ro], ini = D(ini0), fim = somaDias(ini, dd)
  const k0 = km.get(cam.id)!, k1 = k0 + r[2] + vazio
  const [v] = await db.insert(s.viagens).values({
    motoristaId: m.id, caminhaoId: cam.id, origem: r[0], destino: r[1], carga, frete: C(frete), comissaoPct: m.comissaoPct, adiantamento: C(adi),
    inicio: ini, fim, kmInicial: k0, kmFinal: k1, kmVazio: vazio, status: 'encerrada',
  }).returning()
  await db.insert(s.despesas).values([
    { viagemId: v.id, tipo: 'Diesel', valor: C(Math.round(lit * DIESEL)), litros: lit, data: ini, pagoPor: 'empresa', status: 'aprovada' },
    { viagemId: v.id, tipo: 'Pedágio', valor: C(ped), data: ini, pagoPor: 'empresa', status: 'aprovada' },
    { viagemId: v.id, tipo: out > 400 ? 'Borracharia' : 'Alimentação', valor: C(out), data: fim, pagoPor: 'motorista', status: 'aprovada' },
  ])
  km.set(cam.id, k1)
}
const andamento: [number, number, string, string, number, number, [string, number, string, 'empresa' | 'motorista', 'aprovada' | 'pendente', number?][]][] = [
  [3, 1, '2026-10-03', 'Soja 37 t', 22000, 2500, [['Diesel', 3404, '2026-10-03', 'empresa', 'aprovada', 550], ['Pedágio', 690, '2026-10-04', 'empresa', 'aprovada'], ['Alimentação', 96, '2026-10-05', 'motorista', 'pendente']]],
  [4, 3, '2026-10-05', 'Café 28 t', 8800, 800, [['Diesel', 1486, '2026-10-05', 'empresa', 'aprovada', 240], ['Borracharia', 380, '2026-10-06', 'motorista', 'pendente']]],
]
for (const [dr, ro, ini, carga, frete, adi, ds] of andamento) {
  const m = mots[dr - 1], cam = cams[dr - 1], r = RT[ro]
  const [v] = await db.insert(s.viagens).values({
    motoristaId: m.id, caminhaoId: cam.id, origem: r[0], destino: r[1], carga, frete: C(frete), comissaoPct: m.comissaoPct, adiantamento: C(adi),
    inicio: D(ini), kmInicial: km.get(cam.id)!, status: 'andamento',
  }).returning()
  await db.insert(s.despesas).values(ds.map(([tipo, valor, data, pagoPor, status, litros]) => ({ viagemId: v.id, tipo, valor: C(valor), data: D(data), pagoPor, status, litros: litros ?? null })))
}
for (const c of cams) await db.update(s.caminhoes).set({ km: km.get(c.id)! }).where(sql`id = ${c.id}`)

await db.insert(s.manutencoes).values(([
  [1, '2026-09-08', 'Preventiva', 'Troca de óleo e filtros', 2350, false], [4, '2026-09-13', 'Pneus', 'Pneu estourado na BR-040: 1 pneu novo e socorro', 3180, true],
  [2, '2026-09-18', 'Corretiva', 'Troca de lonas de freio da carreta', 2900, false], [3, '2026-09-25', 'Peças', 'Jogo de molas e buchas para estoque', 1840, false],
  [4, '2026-09-27', 'Corretiva', 'Reparo no turbo', 3930, true], [1, '2026-10-04', 'Pneus', 'Recapagem de 4 pneus da carreta', 2600, false],
] as const).map(([t, data, tipo, descricao, valor, imprevisto]) => ({ caminhaoId: cams[t - 1].id, data: D(data), tipo, descricao, valor: C(valor), imprevisto })))

await db.insert(s.apolices).values([
  { nome: 'Seguro casco', cobertura: 'Colisão, incêndio e roubo dos 4 conjuntos', vigenciaAte: D('2026-11-15'), custoMensal: C(6200), obrigatorio: false },
  { nome: 'RC-V (terceiros)', cobertura: 'Danos materiais e corporais a terceiros', vigenciaAte: D('2027-02-01'), custoMensal: C(1150), obrigatorio: true },
  { nome: 'RCTR-C + RC-DC (carga)', cobertura: 'Avaria, roubo e desvio da carga transportada', vigenciaAte: D('2026-10-20'), custoMensal: C(2300), obrigatorio: true },
  { nome: 'Vida dos motoristas', cobertura: 'Morte e invalidez, 4 motoristas', vigenciaAte: D('2027-05-30'), custoMensal: C(340), obrigatorio: false },
])
await db.insert(s.custosFixos).values([
  { nome: 'Parcelas de financiamento', valorMensal: C(11800) }, { nome: 'IPVA e licenciamento (rateio mensal)', valorMensal: C(2850) },
  { nome: 'Contabilidade e sistemas', valorMensal: C(1300) }, { nome: 'Rastreamento e gerenciamento de risco', valorMensal: C(760) },
])
await db.insert(s.lembretes).values({ texto: 'Renovar contrato com a seguradora de carga', data: D('2026-10-15') })

const { gerarPneus } = await import('../src/lib/pneus')
for (const c of cams) await db.insert(s.pneus).values(gerarPneus(c.id, false))

console.log(`Exemplos criados (datas deslocadas ${desloc} dias). Admin: usuário "admin", senha "${process.env.ADMIN_SENHA || 'fg2026'}". Motoristas: celular + PIN 1111, 2222, 3333, 4444.`)
await client.end()
