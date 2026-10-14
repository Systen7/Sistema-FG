import 'server-only'
import { randomUUID } from 'node:crypto'
import { put, get } from '@vercel/blob'

// Fotos dos comprovantes: no Vercel Blob (privado) quando ele está ligado ao projeto; senão, no próprio banco.
export const usaBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)

export async function guardarNoBlob(dados: Buffer, mime: string): Promise<string> {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  const r = await put(`comprovantes/${randomUUID()}.${ext}`, dados, { access: 'private', contentType: mime, addRandomSuffix: false })
  return r.pathname
}

export async function lerDoBlob(chave: string) {
  const r = await get(chave, { access: 'private' })
  return r && r.statusCode === 200 ? r : null
}

/** Apaga fotos/arquivos que ninguém mais usa (no banco e no Blob). Falhas no Blob não travam a operação. */
export async function apagarArquivos(ids: (string | null | undefined)[]) {
  const { db, schema: s } = await import('@/db')
  const { inArray } = await import('drizzle-orm')
  const lista = [...new Set(ids.filter((x): x is string => !!x))]
  if (!lista.length) return
  const linhas = await db.select({ id: s.fotos.id, chave: s.fotos.chave }).from(s.fotos).where(inArray(s.fotos.id, lista))
  const chaves = linhas.map((l) => l.chave).filter((x): x is string => !!x)
  if (chaves.length && usaBlob()) {
    try { const { del } = await import('@vercel/blob'); await del(chaves) } catch (e) { console.error('Falha ao apagar do Blob', e) }
  }
  await db.delete(s.fotos).where(inArray(s.fotos.id, lista))
}
