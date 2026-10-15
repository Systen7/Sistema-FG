import { CheckCheck } from 'lucide-react'
import { pendentes, motoristas } from '@/lib/dados'
import { reaisC } from '@/lib/format'
import { Cabecalho } from '../ui'
import { Pendentes } from '../pendentes'
import { aprovarVarias } from '../actions'
import { Enviar } from '@/components/enviar'

export const metadata = { title: 'Aprovações' }

export default async function Aprovacoes() {
  const [pe, ms] = await Promise.all([pendentes(), motoristas()])
  const total = pe.reduce((s, x) => s + x.d.valor, 0)
  const semFoto = pe.filter((x) => !x.d.fotoId).length
  return (
    <>
      <Cabecalho titulo="Aprovações" texto="Gastos lançados pelos motoristas. Confira o comprovante e aprove ou recuse; o motorista vê o resultado no app.">
        {pe.length > 1 && (
          <form
            action={aprovarVarias.bind(
              null,
              pe.map((x) => x.d.id),
              '/admin/aprovacoes',
            )}
          >
            <Enviar className="btn ok">
              <CheckCheck className="ico" />
              Aprovar todas ({pe.length})
            </Enviar>
          </form>
        )}
      </Cabecalho>
      {pe.length > 0 && (
        <p className="muted">
          {pe.length} {pe.length === 1 ? 'gasto' : 'gastos'} somando {reaisC(total)}
          {semFoto ? ` · ${semFoto} sem foto do comprovante` : ''}.
        </p>
      )}
      <section className="panel">
        <Pendentes itens={pe} motoristas={ms} voltar="/admin/aprovacoes" />
      </section>
    </>
  )
}
