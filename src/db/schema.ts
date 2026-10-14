import {
  pgTable, serial, integer, text, date, timestamp, boolean, numeric, uuid, jsonb, customType, uniqueIndex, index, pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Valores em dinheiro ficam em centavos (inteiro) para não ter erro de arredondamento.

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })
const decimal = (nome: string) => numeric(nome, { precision: 10, scale: 2, mode: 'number' })

export const statusViagem = pgEnum('status_viagem', ['andamento', 'encerrada'])
export const statusDespesa = pgEnum('status_despesa', ['pendente', 'aprovada', 'recusada'])
export const pagoPor = pgEnum('pago_por', ['empresa', 'motorista'])

export const administradores = pgTable('administradores', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  usuario: text('usuario').notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  versaoSessao: integer('versao_sessao').notNull().default(1),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
})

export const caminhoes = pgTable('caminhoes', {
  id: serial('id').primaryKey(),
  placa: text('placa').notNull().unique(),
  placaCarreta: text('placa_carreta'),
  descricao: text('descricao').notNull(),
  ano: integer('ano'),
  km: integer('km').notNull().default(0),
  metaConsumo: decimal('meta_consumo').notNull().default(2.4),
  proximaRevisaoKm: integer('proxima_revisao_km'),
  tacografoAte: date('tacografo_ate'),
  licenciamentoAte: date('licenciamento_ate'),
  ativo: boolean('ativo').notNull().default(true),
})

export const motoristas = pgTable('motoristas', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  telefone: text('telefone').notNull().unique(), // só dígitos, com DDD
  pinHash: text('pin_hash').notNull(),
  comissaoPct: decimal('comissao_pct').notNull().default(10),
  caminhaoId: integer('caminhao_id').references(() => caminhoes.id),
  cnhAte: date('cnh_ate'),
  toxicologicoAte: date('toxicologico_ate'),
  ativo: boolean('ativo').notNull().default(true),
  // Aumentar este número desconecta o motorista de todos os aparelhos (ex.: celular perdido).
  versaoSessao: integer('versao_sessao').notNull().default(1),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
})

export const viagens = pgTable('viagens', {
  id: serial('id').primaryKey(),
  motoristaId: integer('motorista_id').notNull().references(() => motoristas.id),
  caminhaoId: integer('caminhao_id').notNull().references(() => caminhoes.id),
  origem: text('origem').notNull(),
  destino: text('destino').notNull(),
  carga: text('carga').notNull(),
  frete: integer('frete').notNull(),
  // Percentual gravado no início: mudar a comissão do motorista depois não altera viagens antigas.
  comissaoPct: decimal('comissao_pct').notNull(),
  adiantamento: integer('adiantamento').notNull().default(0),
  inicio: date('inicio').notNull(),
  fim: date('fim'),
  kmInicial: integer('km_inicial').notNull(),
  kmFinal: integer('km_final'),
  kmVazio: integer('km_vazio').notNull().default(0),
  status: statusViagem('status').notNull().default('andamento'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('viagens_motorista_idx').on(t.motoristaId),
  index('viagens_inicio_idx').on(t.inicio),
  // Garante no banco: no máximo uma viagem em andamento por motorista.
  uniqueIndex('viagem_ativa_por_motorista').on(t.motoristaId).where(sql`status = 'andamento'`),
])

export const fotos = pgTable('fotos', {
  id: uuid('id').primaryKey().defaultRandom(),
  dados: bytea('dados').notNull(),
  mime: text('mime').notNull(),
  tamanho: integer('tamanho').notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
})

export const despesas = pgTable('despesas', {
  id: serial('id').primaryKey(),
  viagemId: integer('viagem_id').notNull().references(() => viagens.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(),
  valor: integer('valor').notNull(),
  litros: decimal('litros'),
  kmAbastecimento: integer('km_abastecimento'),
  obs: text('obs'),
  data: date('data').notNull(),
  pagoPor: pagoPor('pago_por').notNull().default('empresa'),
  status: statusDespesa('status').notNull().default('pendente'),
  motivoRecusa: text('motivo_recusa'),
  fotoId: uuid('foto_id').references(() => fotos.id, { onDelete: 'set null' }),
  // Identificador gerado no celular: um lançamento reenviado depois de falta de sinal não duplica.
  clientId: text('client_id').unique(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('despesas_viagem_idx').on(t.viagemId), index('despesas_status_idx').on(t.status)])

export const manutencoes = pgTable('manutencoes', {
  id: serial('id').primaryKey(),
  caminhaoId: integer('caminhao_id').notNull().references(() => caminhoes.id),
  data: date('data').notNull(),
  tipo: text('tipo').notNull(),
  descricao: text('descricao').notNull(),
  valor: integer('valor').notNull(),
  imprevisto: boolean('imprevisto').notNull().default(false),
})

export const pneus = pgTable('pneus', {
  id: serial('id').primaryKey(),
  caminhaoId: integer('caminhao_id').notNull().references(() => caminhoes.id, { onDelete: 'cascade' }),
  posicao: integer('posicao').notNull(),
  eixo: text('eixo').notNull(),
  lado: text('lado').notNull(),
  local: text('local').notNull().default(''),
  sulco: decimal('sulco').notNull(),
  recapagens: integer('recapagens').notNull().default(0),
  km: integer('km').notNull().default(0),
  custo: integer('custo').notNull().default(0),
}, (t) => [uniqueIndex('pneu_posicao').on(t.caminhaoId, t.posicao)])

export const apolices = pgTable('apolices', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  cobertura: text('cobertura').notNull(),
  vigenciaAte: date('vigencia_ate'),
  custoMensal: integer('custo_mensal').notNull(),
  obrigatorio: boolean('obrigatorio').notNull().default(false),
})

export const custosFixos = pgTable('custos_fixos', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  valorMensal: integer('valor_mensal').notNull(),
})

export const lembretes = pgTable('lembretes', {
  id: serial('id').primaryKey(),
  texto: text('texto').notNull(),
  data: date('data').notNull(),
})

export const configuracao = pgTable('configuracao', {
  id: integer('id').primaryKey().default(1),
  diasAviso: integer('dias_aviso').notNull().default(60),
  diasUrgente: integer('dias_urgente').notNull().default(20),
  kmAvisoRevisao: integer('km_aviso_revisao').notNull().default(5000),
  sulcoMinimo: decimal('sulco_minimo').notNull().default(3),
  retornoPct: integer('retorno_pct').notNull().default(60),
  nomeEmpresa: text('nome_empresa').notNull().default('Empresa FG'),
  whatsappEscritorio: text('whatsapp_escritorio'),
})

export const alertasDispensados = pgTable('alertas_dispensados', {
  chave: text('chave').primaryKey(),
  em: timestamp('em', { withTimezone: true }).defaultNow().notNull(),
})

export const acertos = pgTable('acertos', {
  id: serial('id').primaryKey(),
  motoristaId: integer('motorista_id').notNull().references(() => motoristas.id),
  mes: text('mes').notNull(), // AAAA-MM
  valor: integer('valor').notNull(),
  pagoEm: timestamp('pago_em', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('acerto_mes_motorista').on(t.motoristaId, t.mes)])

export const linksAcesso = pgTable('links_acesso', {
  id: serial('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  motoristaId: integer('motorista_id').notNull().references(() => motoristas.id, { onDelete: 'cascade' }),
  expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
  usadoEm: timestamp('usado_em', { withTimezone: true }),
})

export const tentativasLogin = pgTable('tentativas_login', {
  chave: text('chave').primaryKey(),
  falhas: integer('falhas').notNull().default(0),
  bloqueadoAte: timestamp('bloqueado_ate', { withTimezone: true }),
})

export const auditoria = pgTable('auditoria', {
  id: serial('id').primaryKey(),
  em: timestamp('em', { withTimezone: true }).defaultNow().notNull(),
  autor: text('autor').notNull(),
  acao: text('acao').notNull(),
  entidade: text('entidade').notNull(),
  entidadeId: text('entidade_id'),
  dados: jsonb('dados'),
}, (t) => [index('auditoria_em_idx').on(t.em)])

export type Motorista = typeof motoristas.$inferSelect
export type Caminhao = typeof caminhoes.$inferSelect
export type Viagem = typeof viagens.$inferSelect
export type Despesa = typeof despesas.$inferSelect
export type Manutencao = typeof manutencoes.$inferSelect
export type Pneu = typeof pneus.$inferSelect
export type Apolice = typeof apolices.$inferSelect
export type CustoFixo = typeof custosFixos.$inferSelect
export type Lembrete = typeof lembretes.$inferSelect
export type Configuracao = typeof configuracao.$inferSelect
