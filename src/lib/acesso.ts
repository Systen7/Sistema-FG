import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'

export const DIAS_LINK = 7
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

/** Cria um link de acesso novo e invalida os anteriores do motorista. */
export async function novoLink(motoristaId: number) {
  const token = randomBytes(18).toString('base64url')
  await db.delete(s.linksAcesso).where(eq(s.linksAcesso.motoristaId, motoristaId))
  await db.insert(s.linksAcesso).values({ tokenHash: hashToken(token), motoristaId, expiraEm: new Date(Date.now() + DIAS_LINK * 864e5) })
  return `${urlBase()}/acesso/${token}`
}

/** Endereço público do sistema: APP_URL, ou o domínio de produção que a Vercel informa. */
export function urlBase() {
  const v = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return (process.env.APP_URL || (v ? `https://${v}` : 'http://localhost:3000')).replace(/\/$/, '')
}
