import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { exigirMotorista } from '@/lib/auth'
import { sugestoes, viagemAtiva } from '@/lib/dados'
import { hoje } from '@/lib/datas'
import { IniciarForm } from './iniciar-form'

export const metadata = { title: 'Iniciar viagem' }

export default async function Iniciar() {
  const m = await exigirMotorista()
  if (await viagemAtiva(m.id)) redirect('/m')
  if (!m.caminhaoId) redirect('/m')
  const [cam] = await db.select().from(s.caminhoes).where(eq(s.caminhoes.id, m.caminhaoId))
  const [meu, geral] = await Promise.all([sugestoes(m.id), sugestoes()])
  const uniq = (a: string[]) => [...new Set(a)]
  return (
    <IniciarForm
      hoje={hoje()} km={cam.km} placa={cam.placa} comissao={m.comissaoPct}
      rotas={meu.rotas.length ? meu.rotas : geral.rotas}
      cidades={uniq([...meu.cidades, ...geral.cidades]).slice(0, 40)}
      cargas={uniq([...meu.cargas, ...geral.cargas]).slice(0, 8)}
    />
  )
}
