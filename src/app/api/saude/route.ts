import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { log } from '@/lib/obs/log'

// Verificação de disponibilidade (UptimeRobot, Better Stack, Datadog Synthetics...). Não expõe dado nenhum.
export async function GET() {
  const t = performance.now()
  try {
    await db.execute(sql`select 1`)
    return NextResponse.json({ ok: true, banco: 'ok', ms: Math.round(performance.now() - t), versao: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    log('erro', 'saúde: banco fora do ar', { erro: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ ok: false, banco: 'erro' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
