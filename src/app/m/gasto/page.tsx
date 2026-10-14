import { redirect } from 'next/navigation'
import { exigirMotorista } from '@/lib/auth'
import { viagemAtiva } from '@/lib/dados'
import { hoje } from '@/lib/datas'
import { GastoForm } from './gasto-form'

export const metadata = { title: 'Lançar gasto' }

export default async function Gasto(props: PageProps<'/m/gasto'>) {
  const m = await exigirMotorista()
  const v = await viagemAtiva(m.id)
  if (!v) redirect('/m?erro=' + encodeURIComponent('Inicie uma viagem antes de lançar gastos.'))
  const sp = await props.searchParams
  const id = Number(sp.id)
  const d = id ? v.despesas.find((x) => x.id === id) : null
  if (id && !d) redirect('/m?erro=' + encodeURIComponent('Gasto não encontrado nesta viagem.'))
  return (
    <GastoForm
      viagemId={v.id} rota={`${v.origem.split('/')[0]} → ${v.destino.split('/')[0]}`} hoje={hoje()} inicio={v.inicio}
      editar={d ? { id: d.id, tipo: d.tipo, valor: d.valor, litros: d.litros, km: d.kmAbastecimento, obs: d.obs, pagoPor: d.pagoPor, data: d.data, foto: d.fotoId, status: d.status } : null}
    />
  )
}
