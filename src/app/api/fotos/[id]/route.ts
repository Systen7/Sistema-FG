import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { adminDaApi, motoristaDaApi } from '@/lib/auth'
import { lerDoBlob } from '@/lib/armazenamento'

// Foto de comprovante: o escritório vê todas; o motorista só as das próprias viagens.
export async function GET(_req: Request, ctx: RouteContext<'/api/fotos/[id]'>) {
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 })
  const adm = await adminDaApi()
  if (!adm) {
    const m = await motoristaDaApi()
    if (!m) return new NextResponse(null, { status: 401 })
    const [r] = await db
      .select({ mot: s.viagens.motoristaId })
      .from(s.despesas)
      .innerJoin(s.viagens, eq(s.despesas.viagemId, s.viagens.id))
      .where(eq(s.despesas.fotoId, id))
    if (r?.mot !== m.id) return new NextResponse(null, { status: 404 })
  }
  const [f] = await db.select().from(s.fotos).where(eq(s.fotos.id, id))
  if (!f) return new NextResponse(null, { status: 404 })
  const cab = { 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }
  if (f.chave) {
    const b = await lerDoBlob(f.chave)
    return b ? new NextResponse(b.stream, { headers: cab }) : new NextResponse(null, { status: 404 })
  }
  return f.dados ? new NextResponse(new Uint8Array(f.dados), { headers: cab }) : new NextResponse(null, { status: 404 })
}
