import 'server-only'
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { lerXmlFiscal, chaveValida, type DocLido } from './fiscal'
import { apagarArquivos, guardarArquivo } from './armazenamento'
import { dataDe, somaDias } from './datas'
import { registrar } from './audit'
import { medir, registrarErro } from './obs/log'

export const MAX_XML = 1024 * 1024
export const MAX_PDF = 3 * 1024 * 1024
export type ResultadoArquivo = { arquivo: string; ok: boolean; mensagem: string }
const nomeDoc = (d: { tipo: string; numero: number }) => `${d.tipo === 'cte' ? 'CT-e' : 'MDF-e'} nº ${d.numero}`

/** Procura a viagem de um MDF-e pela placa do cavalo e pela data de emissão (até 1 dia antes/depois). */
async function viagemDoMdfe(placa: string | null, emitidoEm: Date): Promise<number | null> {
  if (!placa) return null
  const [c] = await db.select().from(s.caminhoes).where(eq(s.caminhoes.placa, placa))
  if (!c) return null
  const dia = dataDe(emitidoEm)
  const vs = await db
    .select()
    .from(s.viagens)
    .where(and(eq(s.viagens.caminhaoId, c.id), lte(s.viagens.inicio, somaDias(dia, 1)), or(isNull(s.viagens.fim), gte(s.viagens.fim, somaDias(dia, -1)))))
  if (!vs.length) return null
  // a viagem que começou mais perto da emissão
  vs.sort((a, b) => Math.abs(Date.parse(a.inicio) - Date.parse(dia)) - Math.abs(Date.parse(b.inicio) - Date.parse(dia)))
  return vs[0].id
}

/** Descobre a viagem de um documento novo sem viagem definida. */
async function viagemAutomatica(d: DocLido): Promise<number | null> {
  if (d.tipo === 'mdfe') {
    // 1º: algum CT-e deste MDF-e já está numa viagem; 2º: placa + data
    if (d.chavesCte.length) {
      const [c] = await db
        .select({ v: s.documentos.viagemId })
        .from(s.documentos)
        .where(and(inArray(s.documentos.chave, d.chavesCte), sql`${s.documentos.viagemId} is not null`))
      if (c?.v) return c.v
    }
    return viagemDoMdfe(d.placa, d.emitidoEm)
  }
  // CT-e: pelo MDF-e que já o cita
  const [m] = await db
    .select({ v: s.documentos.viagemId })
    .from(s.documentos)
    .where(and(eq(s.documentos.tipo, 'mdfe'), sql`${s.documentos.chavesCte} @> ${JSON.stringify([d.chave])}::jsonb`, sql`${s.documentos.viagemId} is not null`))
  return m?.v ?? null
}

/** Liga um documento a uma viagem; se for MDF-e, leva junto os CT-e dele que ainda estão sem viagem. */
export async function ligarDocumento(id: number, viagemId: number | null) {
  const [d] = await db.update(s.documentos).set({ viagemId }).where(eq(s.documentos.id, id)).returning()
  if (d && viagemId && d.tipo === 'mdfe' && d.chavesCte?.length) {
    await db
      .update(s.documentos)
      .set({ viagemId })
      .where(and(inArray(s.documentos.chave, d.chavesCte), isNull(s.documentos.viagemId)))
  }
  return d
}

async function importarXml(nome: string, xml: string, alvo: number | null, autor: string): Promise<ResultadoArquivo> {
  const r = lerXmlFiscal(xml)
  if (r.tipo === 'erro') return { arquivo: nome, ok: false, mensagem: r.erro }
  if (r.tipo === 'evento') {
    const [d] = await db.select().from(s.documentos).where(eq(s.documentos.chave, r.chave))
    const qual = r.doc === 'cte' ? 'CT-e' : 'MDF-e'
    if (!d)
      return { arquivo: nome, ok: false, mensagem: `Evento de ${r.evento} de um ${qual} que ainda não está no sistema. Importe primeiro o XML do ${qual}.` }
    if (!r.aceito) return { arquivo: nome, ok: false, mensagem: `O evento de ${r.evento} do ${nomeDoc(d)} foi rejeitado pela SEFAZ; nada mudou.` }
    await db
      .update(s.documentos)
      .set(r.evento === 'encerramento' ? { situacao: 'encerrado', encerradoEm: r.em } : { situacao: 'cancelado' })
      .where(eq(s.documentos.id, d.id))
    await registrar(autor, r.evento === 'encerramento' ? 'registrou encerramento' : 'registrou cancelamento', 'documento', d.id, { chave: d.chave })
    return { arquivo: nome, ok: true, mensagem: `${nomeDoc(d)} marcado como ${r.evento === 'encerramento' ? 'encerrado' : 'cancelado'}.` }
  }
  const { tipo: _t, ...dados } = r
  const [existente] = await db.select().from(s.documentos).where(eq(s.documentos.chave, r.chave))
  const viagemId = alvo ?? existente?.viagemId ?? (await viagemAutomatica(r))
  // Não volta um documento já encerrado/cancelado para "autorizado" ao reimportar o XML original.
  const situacao = existente && existente.situacao !== 'sem_protocolo' && r.situacao === 'autorizado' ? existente.situacao : r.situacao
  const valores = { ...dados, tipo: r.tipo, situacao, xml, viagemId }
  let id: number
  if (existente) {
    await db.update(s.documentos).set(valores).where(eq(s.documentos.id, existente.id))
    id = existente.id
  } else id = (await db.insert(s.documentos).values(valores).returning({ id: s.documentos.id }))[0].id
  if (viagemId) await ligarDocumento(id, viagemId)
  await registrar(autor, existente ? 'reimportou' : 'importou', 'documento', id, { chave: r.chave, viagemId })
  const onde = viagemId ? `ligado à viagem ${viagemId}` : 'sem viagem: ligue manualmente'
  const aviso =
    r.situacao === 'sem_protocolo'
      ? ' Atenção: o XML não tem protocolo de autorização (use o arquivo "proc" do emissor).'
      : r.situacao === 'cancelado'
        ? ' Documento cancelado.'
        : ''
  return { arquivo: nome, ok: true, mensagem: `${nomeDoc({ tipo: r.tipo, numero: r.numero })} ${existente ? 'atualizado' : 'importado'}, ${onde}.${aviso}` }
}

/** Anexa o PDF (DACTE/DAMDFE). Acha o documento pela chave escrita no nome do arquivo ou pelo id informado. */
export async function anexarPdf(nome: string, dados: Buffer, docId: number | null, autor: string): Promise<ResultadoArquivo> {
  if (dados.subarray(0, 4).toString() !== '%PDF') return { arquivo: nome, ok: false, mensagem: 'O arquivo não é um PDF.' }
  if (dados.length > MAX_PDF) return { arquivo: nome, ok: false, mensagem: 'PDF maior que 3 MB.' }
  let d: typeof s.documentos.$inferSelect | undefined
  if (docId) [d] = await db.select().from(s.documentos).where(eq(s.documentos.id, docId))
  else {
    const chave = (nome.match(/\d{44}/g) ?? []).find(chaveValida)
    if (chave) [d] = await db.select().from(s.documentos).where(eq(s.documentos.chave, chave))
    if (!chave) return { arquivo: nome, ok: false, mensagem: 'Não achei a chave de acesso no nome do arquivo. Use o botão "PDF" na linha do documento.' }
  }
  if (!d) return { arquivo: nome, ok: false, mensagem: 'Importe primeiro o XML deste documento; depois o PDF.' }
  const pdfId = await guardarArquivo(dados, 'application/pdf', 'documentos')
  await db.update(s.documentos).set({ pdfId }).where(eq(s.documentos.id, d.id))
  if (d.pdfId) await apagarArquivos([d.pdfId])
  await registrar(autor, 'anexou PDF', 'documento', d.id)
  return { arquivo: nome, ok: true, mensagem: `PDF anexado ao ${nomeDoc(d)}.` }
}

/** Processa vários arquivos (XML primeiro, depois PDF, para o PDF achar o documento recém-importado). */
export const importarArquivos = (arquivos: File[], alvo: number | null, autor: string) =>
  medir('documentos.importar', () => importarTodos(arquivos, alvo, autor), { arquivos: arquivos.length })

async function importarTodos(arquivos: File[], alvo: number | null, autor: string): Promise<ResultadoArquivo[]> {
  const out: ResultadoArquivo[] = []
  const ordem = [...arquivos].sort((a, b) => Number(/\.pdf$/i.test(a.name)) - Number(/\.pdf$/i.test(b.name)))
  for (const f of ordem) {
    try {
      if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') out.push(await anexarPdf(f.name, Buffer.from(await f.arrayBuffer()), null, autor))
      else if (/\.xml$/i.test(f.name) || /xml/.test(f.type)) {
        if (f.size > MAX_XML) {
          out.push({ arquivo: f.name, ok: false, mensagem: 'XML maior que 1 MB; não parece um CT-e ou MDF-e.' })
          continue
        }
        out.push(await importarXml(f.name, await f.text(), alvo, autor))
      } else out.push({ arquivo: f.name, ok: false, mensagem: 'Envie arquivos .xml (CT-e, MDF-e ou eventos) ou .pdf (DACTE/DAMDFE).' })
    } catch (e) {
      registrarErro(e, 'Falha ao importar documento', { arquivo: f.name })
      out.push({ arquivo: f.name, ok: false, mensagem: 'Erro inesperado ao processar este arquivo.' })
    }
  }
  return out
}

/** Documentos de uma ou várias viagens. */
export const documentosDasViagens = (ids: number[]) =>
  ids.length
    ? db.select().from(s.documentos).where(inArray(s.documentos.viagemId, ids)).orderBy(s.documentos.tipo, s.documentos.emitidoEm)
    : Promise.resolve([])
