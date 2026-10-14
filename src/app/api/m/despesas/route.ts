import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { motoristaDaApi } from '@/lib/auth'
import { lerDespesa, salvarFoto } from '@/lib/despesa-entrada'
import { hoje } from '@/lib/datas'
import { registrar } from '@/lib/audit'

// Lançamento de gasto pelo motorista. Aceita reenvio: o mesmo clientId nunca vira dois lançamentos.
export async function POST(req: Request) {
  const m = await motoristaDaApi()
  if (!m) return NextResponse.json({ erro: 'Sessão expirada. Entre de novo.' }, { status: 401 })
  const f = await req.formData()
  const clientId = String(f.get('clientId') ?? '').slice(0, 64) || null
  if (clientId) {
    const [ja] = await db.select({ id: s.despesas.id }).from(s.despesas).where(eq(s.despesas.clientId, clientId))
    if (ja) return NextResponse.json({ ok: true, id: ja.id, repetido: true })
  }
  const viagemId = Number(f.get('viagemId'))
  const [v] = await db.select().from(s.viagens).where(and(eq(s.viagens.id, viagemId), eq(s.viagens.motoristaId, m.id)))
  if (!v) return NextResponse.json({ erro: 'Viagem não encontrada.' }, { status: 404 })
  const e = lerDespesa(f)
  if ('erro' in e) return NextResponse.json(e, { status: 400 })
  if (e.data && (e.data < v.inicio || e.data > hoje())) e.data = null // data fora da viagem: usa a de hoje
  const foto = await salvarFoto(f)
  if (foto && typeof foto === 'object') return NextResponse.json(foto, { status: 400 })
  try {
    const [d] = await db.insert(s.despesas).values({
      viagemId: v.id, tipo: e.tipo, valor: e.valor, litros: e.litros, kmAbastecimento: e.kmAbastecimento, obs: e.obs, pagoPor: e.pagoPor,
      data: e.data ?? hoje(), status: 'pendente', fotoId: foto, clientId,
    }).returning()
    await registrar('motorista:' + m.id, 'lançou', 'despesa', d.id, { viagem: v.id, tipo: d.tipo, valor: d.valor })
    return NextResponse.json({ ok: true, id: d.id })
  } catch (err) {
    // Duas tentativas chegando juntas com o mesmo clientId: a segunda só confirma.
    if (clientId && String(err).includes('client_id')) return NextResponse.json({ ok: true, repetido: true })
    throw err
  }
}
