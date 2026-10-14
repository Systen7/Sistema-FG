'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { exigirAdmin, hash, confere } from '@/lib/auth'
import { novoLink } from '@/lib/acesso'
import { registrar } from '@/lib/audit'
import { gerarPneus, SULCO_NOVO, CUSTO_PNEU_NOVO } from '@/lib/pneus'
import { soDigitos } from '@/lib/format'
import type { Estado } from '@/components/form-modal'
import {
  ErroCampo, ler, camposMotorista, camposCaminhao, camposViagem, camposDespesa, camposManutencao, camposPneu, camposApolice, camposFixo, camposLembrete,
} from './campos'

const comMsg = (url: string, msg: string, chave = 'ok') => url + (url.includes('?') ? '&' : '?') + chave + '=' + encodeURIComponent(msg)

/** Executa uma gravação: erros de preenchimento voltam para o formulário; sucesso volta para a página com aviso. */
async function gravar(fn: (autor: string) => Promise<string>): Promise<Estado> {
  const a = await exigirAdmin()
  let destino: string
  try {
    destino = await fn('admin:' + a.id)
  } catch (e) {
    if (e instanceof ErroCampo) return { erro: e.message }
    const m = String((e as { cause?: unknown })?.cause ?? e)
    if (m.includes('duplicate key') || m.includes('unique')) {
      if (m.includes('placa')) return { erro: 'Já existe um caminhão com esta placa.' }
      if (m.includes('telefone')) return { erro: 'Já existe um motorista com este celular.' }
      if (m.includes('viagem_ativa')) return { erro: 'Este motorista já tem outra viagem em andamento.' }
      return { erro: 'Já existe um cadastro com estes dados.' }
    }
    if (m.includes('foreign key')) return { erro: 'Não é possível excluir: há registros ligados a este cadastro.' }
    throw e
  }
  revalidatePath('/admin', 'layout')
  revalidatePath('/m', 'layout')
  redirect(destino)
}

const opcoesCaminhoes = async (): Promise<[string, string][]> => (await db.select().from(s.caminhoes)).map((c) => [String(c.id), c.placa])
const opcoesMotoristas = async (): Promise<[string, string][]> => (await db.select().from(s.motoristas)).map((m) => [String(m.id), m.nome])
const placa = (p: unknown) => String(p ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

// ---------- motoristas ----------
export async function salvarMotorista(id: number | null, voltar: string, _: Estado, f: FormData) {
  return gravar(async (autor) => {
    const o = ler(f, camposMotorista(await opcoesCaminhoes(), id == null))
    const tel = soDigitos(String(o.telefone))
    if (tel.length < 10 || tel.length > 11) throw new ErroCampo('Celular inválido: use DDD + número.')
    const com = Number(o.comissaoPct)
    if (!(com >= 0 && com <= 50)) throw new ErroCampo('A comissão precisa ficar entre 0 e 50%.')
    const pin = String(f.get('pin') ?? '').trim()
    if ((id == null || pin) && !/^\d{4}$/.test(pin)) throw new ErroCampo('O PIN precisa ter 4 números.')
    const dados = {
      nome: String(o.nome), telefone: tel, comissaoPct: com, caminhaoId: o.caminhaoId ? Number(o.caminhaoId) : null,
      cnhAte: o.cnhAte as string | null, toxicologicoAte: o.toxicologicoAte as string | null, ativo: Boolean(o.ativo),
      ...(pin ? { pinHash: await hash(pin) } : {}),
    }
    if (id == null) {
      const [m] = await db.insert(s.motoristas).values({ ...dados, pinHash: dados.pinHash! }).returning()
      await registrar(autor, 'cadastrou', 'motorista', m.id, { nome: m.nome })
      return comMsg(voltar, 'Motorista cadastrado. Envie o link de acesso pelo WhatsApp.') + '&acesso=' + m.id
    }
    await db.update(s.motoristas).set({ ...dados, ...(dados.ativo ? {} : { versaoSessao: sql`${s.motoristas.versaoSessao} + 1` }) }).where(eq(s.motoristas.id, id))
    await registrar(autor, 'alterou', 'motorista', id, { ...dados, pinHash: pin ? 'alterado' : undefined })
    return comMsg(voltar, 'Alterações salvas')
  })
}
export async function excluirMotorista(id: number, voltar: string) {
  return gravar(async (autor) => {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.viagens).where(eq(s.viagens.motoristaId, id))
    if (n) throw new ErroCampo('Este motorista tem viagens lançadas. Para tirar o acesso, marque como inativo.')
    await db.delete(s.motoristas).where(eq(s.motoristas.id, id))
    await registrar(autor, 'excluiu', 'motorista', id)
    return comMsg(voltar, 'Motorista excluído')
  })
}
export async function gerarLinkAcesso(id: number): Promise<{ link?: string; erro?: string }> {
  const a = await exigirAdmin()
  const [m] = await db.select().from(s.motoristas).where(eq(s.motoristas.id, id))
  if (!m?.ativo) return { erro: 'Motorista inativo.' }
  const link = await novoLink(id)
  await registrar('admin:' + a.id, 'gerou link de acesso', 'motorista', id)
  return { link }
}
export async function desconectarMotorista(id: number, voltar: string) {
  const a = await exigirAdmin()
  await db.update(s.motoristas).set({ versaoSessao: sql`${s.motoristas.versaoSessao} + 1` }).where(eq(s.motoristas.id, id))
  await db.delete(s.linksAcesso).where(eq(s.linksAcesso.motoristaId, id))
  await registrar('admin:' + a.id, 'desconectou aparelhos', 'motorista', id)
  redirect(comMsg(voltar, 'Motorista desconectado de todos os aparelhos'))
}

// ---------- caminhões ----------
export async function salvarCaminhao(id: number | null, voltar: string, _: Estado, f: FormData) {
  return gravar(async (autor) => {
    const o = ler(f, camposCaminhao)
    const p = placa(o.placa)
    if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p)) throw new ErroCampo('Placa inválida. Use o formato ABC1D23 ou ABC1234.')
    const pc = o.placaCarreta ? placa(o.placaCarreta) : null
    const dados = {
      placa: p, placaCarreta: pc, descricao: String(o.descricao), ano: o.ano ? Math.round(Number(o.ano)) : null, km: Math.round(Number(o.km)),
      metaConsumo: Number(o.metaConsumo), proximaRevisaoKm: o.proximaRevisaoKm ? Math.round(Number(o.proximaRevisaoKm)) : null,
      tacografoAte: o.tacografoAte as string | null, licenciamentoAte: o.licenciamentoAte as string | null, ativo: Boolean(o.ativo),
    }
    if (id == null) {
      const [c] = await db.insert(s.caminhoes).values(dados).returning()
      await db.insert(s.pneus).values(gerarPneus(c.id, true))
      await registrar(autor, 'cadastrou', 'caminhão', c.id, { placa: p })
      return comMsg(voltar, 'Caminhão cadastrado')
    }
    await db.update(s.caminhoes).set(dados).where(eq(s.caminhoes.id, id))
    await registrar(autor, 'alterou', 'caminhão', id, dados)
    return comMsg(voltar, 'Alterações salvas')
  })
}
export async function excluirCaminhao(id: number, voltar: string) {
  return gravar(async (autor) => {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.viagens).where(eq(s.viagens.caminhaoId, id))
    if (n) throw new ErroCampo('Este caminhão tem viagens lançadas. Para tirar de operação, marque "Em operação: Não".')
    await db.update(s.motoristas).set({ caminhaoId: null }).where(eq(s.motoristas.caminhaoId, id))
    await db.delete(s.manutencoes).where(eq(s.manutencoes.caminhaoId, id))
    await db.delete(s.caminhoes).where(eq(s.caminhoes.id, id))
    await registrar(autor, 'excluiu', 'caminhão', id)
    return comMsg(voltar, 'Caminhão excluído')
  })
}

// ---------- viagens ----------
export async function salvarViagem(id: number | null, voltar: string, _: Estado, f: FormData) {
  return gravar(async (autor) => {
    const o = ler(f, camposViagem(await opcoesMotoristas(), await opcoesCaminhoes()))
    const motoristaId = Number(o.motoristaId), caminhaoId = Number(o.caminhaoId)
    const [m] = await db.select().from(s.motoristas).where(eq(s.motoristas.id, motoristaId))
    if (!m) throw new ErroCampo('Escolha o motorista.')
    const status = o.status as 'andamento' | 'encerrada'
    const kmInicial = Math.round(Number(o.kmInicial))
    let kmFinal = o.kmFinal != null ? Math.round(Number(o.kmFinal)) : null
    let fim = o.fim as string | null
    const kmVazio = Math.round(Number(o.kmVazio ?? 0))
    if (status === 'encerrada') {
      if (!fim) throw new ErroCampo('Informe a data de chegada.')
      if (fim < String(o.inicio)) throw new ErroCampo('A chegada não pode ser antes do início.')
      if (!kmFinal || kmFinal <= kmInicial) throw new ErroCampo('O km final precisa ser maior que o km inicial.')
      if (kmVazio >= kmFinal - kmInicial) throw new ErroCampo('O km vazio precisa ser menor que o total rodado.')
    } else { kmFinal = null; fim = null }
    const com = o.comissaoPct != null ? Number(o.comissaoPct) : null
    if (com != null && !(com >= 0 && com <= 50)) throw new ErroCampo('A comissão precisa ficar entre 0 e 50%.')
    const dados = {
      motoristaId, caminhaoId, origem: String(o.origem), destino: String(o.destino), carga: String(o.carga), frete: Number(o.frete),
      adiantamento: Number(o.adiantamento ?? 0), inicio: String(o.inicio), kmInicial, kmFinal, fim, kmVazio, status,
    }
    let vid = id
    if (id == null) {
      const [v] = await db.insert(s.viagens).values({ ...dados, comissaoPct: com ?? m.comissaoPct }).returning()
      vid = v.id
      await registrar(autor, 'criou', 'viagem', v.id, dados)
    } else {
      await db.update(s.viagens).set({ ...dados, ...(com != null ? { comissaoPct: com } : {}) }).where(eq(s.viagens.id, id))
      await registrar(autor, 'alterou', 'viagem', id, dados)
    }
    if (kmFinal) await db.update(s.caminhoes).set({ km: sql`greatest(${s.caminhoes.km}, ${kmFinal})` }).where(eq(s.caminhoes.id, caminhaoId))
    return comMsg(voltar === '#nova' ? `/admin/viagens/${vid}` : voltar, id == null ? 'Viagem criada' : 'Viagem salva')
  })
}
export async function excluirViagem(id: number) {
  return gravar(async (autor) => {
    const [v] = await db.select().from(s.viagens).where(eq(s.viagens.id, id))
    await db.delete(s.viagens).where(eq(s.viagens.id, id))
    await registrar(autor, 'excluiu', 'viagem', id, v)
    return comMsg('/admin/viagens', `Viagem ${id} excluída`)
  })
}

// ---------- despesas ----------
export async function salvarDespesa(id: number | null, viagemId: number, voltar: string, _: Estado, f: FormData) {
  return gravar(async (autor) => {
    const o = ler(f, camposDespesa)
    if (!Number(o.valor)) throw new ErroCampo('Informe o valor.')
    if (o.tipo === 'Diesel' && !o.litros) throw new ErroCampo('Informe os litros do abastecimento.')
    const dados = {
      tipo: String(o.tipo), valor: Number(o.valor), litros: o.tipo === 'Diesel' ? Number(o.litros) : null, data: String(o.data),
      pagoPor: o.pagoPor as 'empresa' | 'motorista', status: o.status as 'aprovada' | 'pendente' | 'recusada', obs: o.obs as string | null,
    }
    if (id == null) {
      const [d] = await db.insert(s.despesas).values({ ...dados, viagemId }).returning()
      await registrar(autor, 'lançou', 'despesa', d.id, dados)
    } else {
      await db.update(s.despesas).set(dados).where(eq(s.despesas.id, id))
      await registrar(autor, 'alterou', 'despesa', id, dados)
    }
    return comMsg(voltar, 'Despesa salva')
  })
}
export async function excluirDespesa(id: number, voltar: string) {
  return gravar(async (autor) => {
    const [d] = await db.select().from(s.despesas).where(eq(s.despesas.id, id))
    await db.delete(s.despesas).where(eq(s.despesas.id, id))
    await registrar(autor, 'excluiu', 'despesa', id, d)
    return comMsg(voltar, 'Despesa excluída')
  })
}
export async function aprovarDespesa(id: number, voltar: string) {
  const a = await exigirAdmin()
  await db.update(s.despesas).set({ status: 'aprovada', motivoRecusa: null }).where(eq(s.despesas.id, id))
  await registrar('admin:' + a.id, 'aprovou', 'despesa', id)
  revalidatePath('/admin', 'layout')
  redirect(comMsg(voltar, 'Despesa aprovada'))
}
export async function recusarDespesa(id: number, voltar: string, f: FormData) {
  const a = await exigirAdmin()
  const motivo = String(f.get('motivo') ?? '').trim().slice(0, 200) || null
  await db.update(s.despesas).set({ status: 'recusada', motivoRecusa: motivo }).where(eq(s.despesas.id, id))
  await registrar('admin:' + a.id, 'recusou', 'despesa', id, { motivo })
  revalidatePath('/admin', 'layout')
  redirect(comMsg(voltar, 'Despesa recusada'))
}
export async function aprovarVarias(ids: number[], voltar: string) {
  const a = await exigirAdmin()
  for (const id of ids) {
    await db.update(s.despesas).set({ status: 'aprovada', motivoRecusa: null }).where(and(eq(s.despesas.id, id), eq(s.despesas.status, 'pendente')))
  }
  await registrar('admin:' + a.id, 'aprovou em lote', 'despesa', null, { ids })
  revalidatePath('/admin', 'layout')
  redirect(comMsg(voltar, ids.length === 1 ? 'Despesa aprovada' : `${ids.length} despesas aprovadas`))
}

// ---------- manutenção e pneus ----------
export async function salvarManutencao(id: number | null, voltar: string, _: Estado, f: FormData) {
  return gravar(async (autor) => {
    const o = ler(f, camposManutencao(await opcoesCaminhoes()))
    const dados = { caminhaoId: Number(o.caminhaoId), data: String(o.data), tipo: String(o.tipo), descricao: String(o.descricao), valor: Number(o.valor), imprevisto: Boolean(o.imprevisto) }
    if (id == null) await db.insert(s.manutencoes).values(dados)
    else await db.update(s.manutencoes).set(dados).where(eq(s.manutencoes.id, id))
    await registrar(autor, id == null ? 'lançou' : 'alterou', 'manutenção', id, dados)
    return comMsg(voltar, 'Manutenção salva')
  })
}
export async function excluirManutencao(id: number, voltar: string) {
  return gravar(async (autor) => {
    await db.delete(s.manutencoes).where(eq(s.manutencoes.id, id))
    await registrar(autor, 'excluiu', 'manutenção', id)
    return comMsg(voltar, 'Manutenção excluída')
  })
}
export async function salvarPneu(id: number, voltar: string, _: Estado, f: FormData) {
  return gravar(async (autor) => {
    const o = ler(f, camposPneu)
    const dados = { sulco: Number(o.sulco), recapagens: Math.round(Number(o.recapagens)), km: Math.round(Number(o.km)), custo: Number(o.custo) }
    if (dados.sulco > 25) throw new ErroCampo('Sulco acima do possível. Confira o valor em milímetros.')
    await db.update(s.pneus).set(dados).where(eq(s.pneus.id, id))
    await registrar(autor, 'alterou', 'pneu', id, dados)
    return comMsg(voltar, 'Pneu atualizado')
  })
}
export async function trocarPneu(id: number, voltar: string, f: FormData) {
  const a = await exigirAdmin()
  const [p] = await db.select().from(s.pneus).where(eq(s.pneus.id, id))
  const recapar = f.get('modo') === 'recapar'
  await db.update(s.pneus).set(recapar
    ? { sulco: 12, recapagens: p.recapagens + 1, custo: p.custo + 78000 }
    : { sulco: SULCO_NOVO, recapagens: 0, km: 0, custo: CUSTO_PNEU_NOVO }).where(eq(s.pneus.id, id))
  await registrar('admin:' + a.id, recapar ? 'recapou' : 'trocou', 'pneu', id, { antes: p })
  revalidatePath('/admin', 'layout')
  redirect(comMsg(voltar, recapar ? 'Recapagem registrada' : 'Pneu novo registrado'))
}

// ---------- seguros, custos fixos, lembretes ----------
export async function salvarApolice(id: number | null, voltar: string, _: Estado, f: FormData) {
  return gravar(async (autor) => {
    const o = ler(f, camposApolice)
    const dados = { nome: String(o.nome), cobertura: String(o.cobertura), vigenciaAte: o.vigenciaAte as string | null, custoMensal: Number(o.custoMensal), obrigatorio: Boolean(o.obrigatorio) }
    if (id == null) await db.insert(s.apolices).values(dados)
    else await db.update(s.apolices).set(dados).where(eq(s.apolices.id, id))
    await registrar(autor, id == null ? 'cadastrou' : 'alterou', 'apólice', id, dados)
    return comMsg(voltar, 'Apólice salva')
  })
}
export async function excluirApolice(id: number, voltar: string) {
  return gravar(async (autor) => {
    await db.delete(s.apolices).where(eq(s.apolices.id, id))
    await registrar(autor, 'excluiu', 'apólice', id)
    return comMsg(voltar, 'Apólice excluída')
  })
}
export async function salvarFixo(id: number | null, voltar: string, _: Estado, f: FormData) {
  return gravar(async (autor) => {
    const o = ler(f, camposFixo)
    const dados = { nome: String(o.nome), valorMensal: Number(o.valorMensal) }
    if (id == null) await db.insert(s.custosFixos).values(dados)
    else await db.update(s.custosFixos).set(dados).where(eq(s.custosFixos.id, id))
    await registrar(autor, id == null ? 'cadastrou' : 'alterou', 'custo fixo', id, dados)
    return comMsg(voltar, 'Custo fixo salvo')
  })
}
export async function excluirFixo(id: number, voltar: string) {
  return gravar(async (autor) => {
    await db.delete(s.custosFixos).where(eq(s.custosFixos.id, id))
    await registrar(autor, 'excluiu', 'custo fixo', id)
    return comMsg(voltar, 'Custo fixo excluído')
  })
}
export async function salvarLembrete(id: number | null, voltar: string, _: Estado, f: FormData) {
  return gravar(async (autor) => {
    const o = ler(f, camposLembrete)
    const dados = { texto: String(o.texto), data: String(o.data) }
    if (id == null) await db.insert(s.lembretes).values(dados)
    else await db.update(s.lembretes).set(dados).where(eq(s.lembretes.id, id))
    await registrar(autor, id == null ? 'criou' : 'alterou', 'lembrete', id, dados)
    return comMsg(voltar, 'Lembrete salvo')
  })
}
export async function excluirLembrete(id: number, voltar: string) {
  return gravar(async (autor) => {
    await db.delete(s.lembretes).where(eq(s.lembretes.id, id))
    await registrar(autor, 'excluiu', 'lembrete', id)
    return comMsg(voltar, 'Lembrete excluído')
  })
}

// ---------- alertas ----------
export async function dispensarAlerta(chave: string, voltar: string) {
  await exigirAdmin()
  await db.insert(s.alertasDispensados).values({ chave }).onConflictDoNothing()
  revalidatePath('/admin', 'layout')
  redirect(comMsg(voltar, 'Alerta dispensado'))
}
export async function restaurarAlertas(voltar: string) {
  await exigirAdmin()
  await db.delete(s.alertasDispensados)
  revalidatePath('/admin', 'layout')
  redirect(comMsg(voltar, 'Alertas restaurados'))
}

// ---------- configurações ----------
export async function salvarConfig(_: Estado, f: FormData): Promise<Estado> {
  return gravar(async (autor) => {
    const n = (k: string, rot: string, min = 0, max = 100000) => {
      const v = Number(String(f.get(k) ?? '').replace(',', '.'))
      if (!Number.isFinite(v) || v < min || v > max) throw new ErroCampo(`Valor inválido em "${rot}".`)
      return v
    }
    const dados = {
      diasAviso: Math.round(n('diasAviso', 'Avisar com quantos dias', 1, 365)), diasUrgente: Math.round(n('diasUrgente', 'Urgente com quantos dias', 0, 365)),
      kmAvisoRevisao: Math.round(n('kmAvisoRevisao', 'Aviso de revisão', 0, 100000)), sulcoMinimo: n('sulcoMinimo', 'Sulco mínimo', 1.6, 15),
      retornoPct: Math.round(n('retornoPct', 'Frete de retorno', 0, 100)),
      nomeEmpresa: String(f.get('nomeEmpresa') ?? '').trim() || 'Empresa FG',
      whatsappEscritorio: soDigitos(String(f.get('whatsappEscritorio') ?? '')) || null,
    }
    if (dados.diasUrgente > dados.diasAviso) throw new ErroCampo('O prazo urgente precisa ser menor ou igual ao prazo de aviso.')
    if (dados.whatsappEscritorio && dados.whatsappEscritorio.length < 10) throw new ErroCampo('WhatsApp do escritório: use DDD + número.')
    await db.update(s.configuracao).set(dados).where(eq(s.configuracao.id, 1))
    await registrar(autor, 'alterou', 'configurações', 1, dados)
    const v = String(f.get('voltar') ?? '')
    return (v.startsWith('/admin') ? v : '/admin/config') + '?ok=' + encodeURIComponent('Configurações salvas')
  })
}
export async function trocarSenha(_: Estado, f: FormData): Promise<Estado> {
  const a = await exigirAdmin()
  const atual = String(f.get('atual') ?? ''), nova = String(f.get('nova') ?? '')
  if (!(await confere(atual, a.senhaHash))) return { erro: 'A senha atual não confere.' }
  if (nova.length < 8) return { erro: 'A nova senha precisa ter pelo menos 8 caracteres.' }
  if (nova !== String(f.get('confirma') ?? '')) return { erro: 'A confirmação não bate com a nova senha.' }
  await db.update(s.administradores).set({ senhaHash: await hash(nova) }).where(eq(s.administradores.id, a.id))
  await registrar('admin:' + a.id, 'trocou a senha', 'administrador', a.id)
  redirect('/admin/config?ok=' + encodeURIComponent('Senha alterada'))
}
export async function novoAdmin(_: Estado, f: FormData): Promise<Estado> {
  return gravar(async (autor) => {
    const nome = String(f.get('nome') ?? '').trim(), usuario = String(f.get('usuario') ?? '').trim().toLowerCase(), senha = String(f.get('senha') ?? '')
    if (!nome || !/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new ErroCampo('Preencha o nome e um usuário sem espaços (3 a 30 letras ou números).')
    if (senha.length < 8) throw new ErroCampo('A senha precisa ter pelo menos 8 caracteres.')
    const [x] = await db.select().from(s.administradores).where(eq(s.administradores.usuario, usuario))
    if (x) throw new ErroCampo('Este usuário já existe.')
    await db.insert(s.administradores).values({ nome, usuario, senhaHash: await hash(senha) })
    await registrar(autor, 'cadastrou', 'administrador', usuario)
    return '/admin/config?ok=' + encodeURIComponent('Acesso criado para ' + nome)
  })
}
export async function removerAdmin(id: number) {
  const a = await exigirAdmin()
  if (id === a.id) redirect('/admin/config?erro=' + encodeURIComponent('Você não pode remover o próprio acesso.'))
  await db.delete(s.administradores).where(and(eq(s.administradores.id, id), ne(s.administradores.id, a.id)))
  await registrar('admin:' + a.id, 'removeu', 'administrador', id)
  redirect('/admin/config?ok=' + encodeURIComponent('Acesso removido'))
}

// ---------- acerto ----------
export async function marcarPago(motoristaId: number, mes: string, valor: number, voltar: string) {
  const a = await exigirAdmin()
  await db.insert(s.acertos).values({ motoristaId, mes, valor }).onConflictDoUpdate({ target: [s.acertos.motoristaId, s.acertos.mes], set: { valor, pagoEm: new Date() } })
  await registrar('admin:' + a.id, 'marcou acerto como pago', 'acerto', `${motoristaId}/${mes}`, { valor })
  revalidatePath('/admin', 'layout')
  redirect(comMsg(voltar, 'Acerto marcado como pago'))
}
export async function desfazerPago(motoristaId: number, mes: string, voltar: string) {
  const a = await exigirAdmin()
  await db.delete(s.acertos).where(and(eq(s.acertos.motoristaId, motoristaId), eq(s.acertos.mes, mes)))
  await registrar('admin:' + a.id, 'desfez pagamento do acerto', 'acerto', `${motoristaId}/${mes}`)
  revalidatePath('/admin', 'layout')
  redirect(comMsg(voltar, 'Pagamento desfeito'))
}
