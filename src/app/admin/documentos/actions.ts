'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { exigirAdmin } from '@/lib/auth'
import { importarArquivos, anexarPdf, ligarDocumento, type ResultadoArquivo } from '@/lib/documentos'
import { apagarArquivos } from '@/lib/armazenamento'
import { registrar } from '@/lib/audit'

const comMsg = (url: string, msg: string) => url + (url.includes('?') ? '&' : '?') + 'ok=' + encodeURIComponent(msg)
const atualizar = () => { revalidatePath('/admin', 'layout'); revalidatePath('/m', 'layout') }

export type EstadoImport = { resultados?: ResultadoArquivo[]; erro?: string } | undefined

export async function importarDocumentos(viagemId: number | null, _: EstadoImport, f: FormData): Promise<EstadoImport> {
  const a = await exigirAdmin()
  const arquivos = f.getAll('arquivos').filter((x): x is File => x instanceof File && x.size > 0)
  if (!arquivos.length) return { erro: 'Escolha um ou mais arquivos XML ou PDF.' }
  if (arquivos.length > 50) return { erro: 'Envie no máximo 50 arquivos por vez.' }
  const resultados = await importarArquivos(arquivos, viagemId, 'admin:' + a.id)
  atualizar()
  return { resultados }
}

export async function ligarDoc(id: number, voltar: string, f: FormData) {
  const a = await exigirAdmin()
  const v = Number(f.get('viagemId')) || null
  await ligarDocumento(id, v)
  await registrar('admin:' + a.id, v ? 'ligou à viagem' : 'desligou da viagem', 'documento', id, { viagemId: v })
  atualizar()
  redirect(comMsg(voltar, v ? `Documento ligado à viagem ${v}` : 'Documento desligado da viagem'))
}

export async function marcarEncerrado(id: number, voltar: string) {
  const a = await exigirAdmin()
  await db.update(s.documentos).set({ situacao: 'encerrado', encerradoEm: new Date() }).where(eq(s.documentos.id, id))
  await registrar('admin:' + a.id, 'marcou como encerrado', 'documento', id)
  atualizar()
  redirect(comMsg(voltar, 'MDF-e marcado como encerrado'))
}

export async function reabrirDoc(id: number, voltar: string) {
  const a = await exigirAdmin()
  await db.update(s.documentos).set({ situacao: 'autorizado', encerradoEm: null }).where(eq(s.documentos.id, id))
  await registrar('admin:' + a.id, 'desfez encerramento', 'documento', id)
  atualizar()
  redirect(comMsg(voltar, 'Encerramento desfeito'))
}

export async function excluirDoc(id: number, voltar: string) {
  const a = await exigirAdmin()
  const [d] = await db.delete(s.documentos).where(eq(s.documentos.id, id)).returning()
  if (d) { await apagarArquivos([d.pdfId]); await registrar('admin:' + a.id, 'excluiu', 'documento', id, { chave: d.chave }) }
  atualizar()
  redirect(comMsg(voltar, 'Documento excluído do sistema'))
}

export async function anexarPdfDoc(id: number, voltar: string, f: FormData) {
  const a = await exigirAdmin()
  const arq = f.get('pdf')
  if (!(arq instanceof File) || !arq.size) redirect(voltar)
  const r = await anexarPdf(arq.name, Buffer.from(await arq.arrayBuffer()), id, 'admin:' + a.id)
  atualizar()
  redirect(voltar + (voltar.includes('?') ? '&' : '?') + (r.ok ? 'ok=' : 'erro=') + encodeURIComponent(r.mensagem))
}

/** Usa a soma dos CT-e autorizados como frete da viagem. */
export async function usarFreteDosCte(viagemId: number, valor: number, voltar: string) {
  const a = await exigirAdmin()
  await db.update(s.viagens).set({ frete: valor }).where(eq(s.viagens.id, viagemId))
  await registrar('admin:' + a.id, 'ajustou frete pelo CT-e', 'viagem', viagemId, { frete: valor })
  atualizar()
  redirect(comMsg(voltar, 'Frete atualizado pelo valor do CT-e'))
}
