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
