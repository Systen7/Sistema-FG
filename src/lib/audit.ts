import 'server-only'
import { db, schema as s } from '@/db'

export async function registrar(autor: string, acao: string, entidade: string, entidadeId: number | string | null, dados?: unknown) {
  try {
    await db.insert(s.auditoria).values({ autor, acao, entidade, entidadeId: entidadeId == null ? null : String(entidadeId), dados: dados ?? null })
  } catch (e) {
    console.error('Falha ao registrar auditoria', e)
  }
}
