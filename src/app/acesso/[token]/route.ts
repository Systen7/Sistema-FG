import { NextResponse } from 'next/server'
import { and, eq, gt } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { hashToken } from '@/lib/acesso'
import { iniciarSessao } from '@/lib/auth'

// Link enviado pelo WhatsApp: o motorista toca e já entra, sem digitar nada.
// Vale por 7 dias e pode ser aberto mais de uma vez (ex.: primeiro no WhatsApp, depois no navegador).
export async function GET(req: Request, ctx: RouteContext<'/acesso/[token]'>) {
  const { token } = await ctx.params
  const [l] = await db.select().from(s.linksAcesso)
    .where(and(eq(s.linksAcesso.tokenHash, hashToken(token)), gt(s.linksAcesso.expiraEm, new Date())))
  const [m] = l ? await db.select().from(s.motoristas).where(eq(s.motoristas.id, l.motoristaId)) : []
  if (!l || !m?.ativo) return NextResponse.redirect(new URL('/entrar?link=expirado', req.url))
  await db.update(s.linksAcesso).set({ usadoEm: new Date() }).where(eq(s.linksAcesso.id, l.id))
  await iniciarSessao({ tipo: 'motorista', id: m.id, v: m.versaoSessao })
  const res = NextResponse.redirect(new URL('/m/bem-vindo', req.url))
  res.headers.set('Cache-Control', 'no-store')
  return res
}
