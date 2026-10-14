import { redirect } from 'next/navigation'
import { exigirMotorista } from '@/lib/auth'
import { config, viagemAtiva } from '@/lib/dados'
import { calcViagem } from '@/lib/calc'
import { hoje } from '@/lib/datas'
import { EncerrarForm } from './encerrar-form'

export const metadata = { title: 'Encerrar viagem' }

export default async function Encerrar() {
  const m = await exigirMotorista()
  const v = await viagemAtiva(m.id)
  if (!v) redirect('/m')
  const c = calcViagem(v, (await config()).retornoPct)
  return (
    <EncerrarForm
      id={v.id} origem={v.origem} destino={v.destino} kmInicial={v.kmInicial} inicio={v.inicio} hoje={hoje()}
      frete={v.frete} comissao={c.comissao} gastos={c.total} pendentes={c.pendentes}
    />
  )
}
