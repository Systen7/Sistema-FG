import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { adminDaApi, motoristaDaApi } from '@/lib/auth'
import { lerDoBlob } from '@/lib/armazenamento'

// /api/documentos/12/pdf: DACTE/DAMDFE (escritório e o motorista da viagem)
// /api/documentos/12/xml: XML original (só escritório)
export async function GET(_req: Request, ctx: RouteContext<'/api/documentos/[id]/[arquivo]'>) {
  const { id, arquivo } = await ctx.params
  const [d] = await db.select().from(s.documentos).where(eq(s.documentos.id, Number(id) || 0))
  if (!d || (arquivo !== 'pdf' && arquivo !== 'xml')) return new NextResponse(null, { status: 404 })
  const adm = await adminDaApi()
  if (!adm) {
    const m = arquivo === 'pdf' ? await motoristaDaApi() : null
    if (!m) return new NextResponse(null, { status: 401 })
    const [v] = d.viagemId ? await db.select().from(s.viagens).where(eq(s.viagens.id, d.viagemId)) : []
    if (v?.motoristaId !== m.id) return new NextResponse(null, { status: 404 })
  }
  const nome = `${d.tipo === 'cte' ? 'CTe' : 'MDFe'}-${d.numero}-${d.chave}`
  if (arquivo === 'xml') {
    return new NextResponse(d.xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${nome}.xml"`, 'Cache-Control': 'private, no-store' } })
  }
  if (!d.pdfId) return new NextResponse(null, { status: 404 })
  const [f] = await db.select().from(s.fotos).where(eq(s.fotos.id, d.pdfId))
  if (!f) return new NextResponse(null, { status: 404 })
  const cab = { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${nome}.pdf"`, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' }
  if (f.chave) {
    const b = await lerDoBlob(f.chave)
    return b ? new NextResponse(b.stream, { headers: cab }) : new NextResponse(null, { status: 404 })
  }
  return f.dados ? new NextResponse(new Uint8Array(f.dados), { headers: cab }) : new NextResponse(null, { status: 404 })
}
