import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { PrimeiroAcesso } from './form'

export const metadata: Metadata = { title: 'Primeiro acesso' }

// Só existe enquanto não há nenhum acesso do escritório: cria o primeiro administrador pelo navegador.
export default async function Configurar() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.administradores)
  if (n > 0) redirect('/entrar')
  return (
    <main className="login">
      <div className="brand"><i>FG</i>Sistema FG</div>
      <section className="hero">
        <div>
          <h1 style={{ fontSize: 30 }}>Primeiro acesso</h1>
          <p className="muted" style={{ marginTop: 6 }}>Crie o seu acesso de administrador. Esta tela some assim que ele for criado.</p>
        </div>
        <PrimeiroAcesso />
      </section>
    </main>
  )
}
