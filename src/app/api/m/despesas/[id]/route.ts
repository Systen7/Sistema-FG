import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { motoristaDaApi } from '@/lib/auth'
import { lerDespesa, salvarFoto } from '@/lib/despesa-entrada'
import { registrar } from '@/lib/audit'
import { apagarArquivos } from '@/lib/armazenamento'
import { hoje } from '@/lib/datas'

async function carregar(id: number, motoristaId: number) {
  const [r] = await db
    .select({ d: s.despesas, v: s.viagens })
    .from(s.despesas)
    .innerJoin(s.viagens, eq(s.despesas.viagemId, s.viagens.id))
    .where(eq(s.despesas.id, id))
  if (!r || r.v.motoristaId !== motoristaId) return { erro: 'Lançamento não encontrado.', status: 404 } as const
  if (r.v.status !== 'andamento') return { erro: 'A viagem já foi encerrada. Para corrigir, fale com o escritório.', status: 409 } as const
  return r
}

// Editar: um gasto alterado volta para aprovação do escritório.
export async function PATCH(req: Request, ctx: RouteContext<'/api/m/despesas/[id]'>) {
  const m = await motoristaDaApi()
  if (!m) return NextResponse.json({ erro: 'Sessão expirada. Entre de novo.' }, { status: 401 })
  const r = await carregar(Number((await ctx.params).id), m.id)
  if ('erro' in r) return NextResponse.json({ erro: r.erro }, { status: r.status })
  const f = await req.formData()
  const e = lerDespesa(f)
  if ('erro' in e) return NextResponse.json(e, { status: 400 })
  const foto = await salvarFoto(f)
  if (foto && typeof foto === 'object') return NextResponse.json(foto, { status: 400 })
  if (e.data && (e.data < r.v.inicio || e.data > hoje()))
    return NextResponse.json({ erro: 'A data precisa estar entre o início da viagem e hoje.' }, { status: 400 })
  const trocouFoto = (foto || f.get('semFoto') === '1') && r.d.fotoId
  await db
    .update(s.despesas)
    .set({
      tipo: e.tipo,
      valor: e.valor,
      litros: e.litros,
      kmAbastecimento: e.kmAbastecimento,
      obs: e.obs,
      pagoPor: e.pagoPor,
      ...(e.data ? { data: e.data } : {}),
      status: 'pendente',
      motivoRecusa: null,
      ...(foto ? { fotoId: foto } : {}),
      ...(f.get('semFoto') === '1' ? { fotoId: null } : {}),
    })
    .where(eq(s.despesas.id, r.d.id))
  if (trocouFoto) await apagarArquivos([r.d.fotoId])
  await registrar(`motorista:${m.id}`, 'editou', 'despesa', r.d.id, { antes: { valor: r.d.valor, tipo: r.d.tipo }, depois: { valor: e.valor, tipo: e.tipo } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/m/despesas/[id]'>) {
  const m = await motoristaDaApi()
  if (!m) return NextResponse.json({ erro: 'Sessão expirada. Entre de novo.' }, { status: 401 })
  const r = await carregar(Number((await ctx.params).id), m.id)
  if ('erro' in r) return NextResponse.json({ erro: r.erro }, { status: r.status })
  if (r.d.status === 'aprovada') return NextResponse.json({ erro: 'Este gasto já foi aprovado. Para apagar, fale com o escritório.' }, { status: 409 })
  await db.delete(s.despesas).where(eq(s.despesas.id, r.d.id))
  await apagarArquivos([r.d.fotoId])
  await registrar(`motorista:${m.id}`, 'excluiu', 'despesa', r.d.id, { tipo: r.d.tipo, valor: r.d.valor })
  return NextResponse.json({ ok: true })
}
