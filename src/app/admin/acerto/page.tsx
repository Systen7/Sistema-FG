import Link from 'next/link'
import { config, motoristas, viagensDoMes, acertosDoMes, mesesDisponiveis } from '@/lib/dados'
import { acerto } from '@/lib/calc'
import { mesAtual, mesValido, nomeMes, dataDe } from '@/lib/datas'
import { dataLonga, reaisC } from '@/lib/format'
import { Cabecalho, Periodo } from '../ui'
import { marcarPago, desfazerPago } from '../actions'
import { Enviar } from '@/components/enviar'

export const metadata = { title: 'Acerto' }

export default async function Acerto(props: PageProps<'/admin/acerto'>) {
  const sp = await props.searchParams
  const atual = mesAtual()
  const mes = mesValido(sp.mes) && sp.mes <= atual ? sp.mes : atual
  const [cfg, ms, vs, pagos, meses] = await Promise.all([config(), motoristas(), viagensDoMes(mes), acertosDoMes(mes), mesesDisponiveis(atual)])
  const aqui = `/admin/acerto?mes=${mes}`
  const linhas = ms.map((m) => ({ m, a: acerto(vs.filter((v) => v.motoristaId === m.id && v.status === 'encerrada'), cfg.retornoPct), pago: pagos.find((p) => p.motoristaId === m.id) }))
    .filter((l) => l.m.ativo || l.a.viagens)
  const pend = vs.filter((v) => v.despesas.some((d) => d.status === 'pendente' && d.pagoPor === 'motorista')).length
  const tot = linhas.reduce((s, l) => s + (l.pago ? 0 : Math.max(0, l.a.saldo)), 0)
  return (
    <>
      <Cabecalho titulo="Acerto de motoristas" texto="Comissões e reembolsos a favor do motorista, menos os adiantamentos. Só entram viagens encerradas e gastos aprovados.">
        <Periodo meses={meses} mes={mes} base="/admin/acerto" />
      </Cabecalho>
      {pend > 0 && <p className="aviso warn">{pend} {pend === 1 ? 'viagem tem' : 'viagens têm'} gastos do bolso ainda sem aprovação; eles só entram no acerto depois de aprovados. <Link href="/admin/aprovacoes">Ver aprovações</Link></p>}
      <section className="panel">
        <div className="scroll"><table>
          <thead><tr><th>Motorista</th><th className="r">Viagens</th><th className="r">Comissões</th><th className="r">Reembolsos</th><th className="r">Adiantamentos</th><th className="r">Saldo</th><th /></tr></thead>
          <tbody>
            {linhas.map(({ m, a, pago }) => (
              <tr key={m.id}>
                <td><Link href={`/admin/viagens?motorista=${m.id}&mes=${mes}&status=encerrada`} style={{ color: 'inherit' }}>{m.nome}</Link></td>
                <td className="r">{a.viagens}</td><td className="r">{reaisC(a.comissao)}</td><td className="r">{reaisC(a.reembolso)}</td><td className="r">{reaisC(-a.adiantamento)}</td>
                <td className="r"><b style={{ color: a.saldo < 0 ? 'var(--bad)' : undefined }}>{reaisC(a.saldo)}</b>{a.saldo < 0 && <><br /><span className="small muted">motorista devolve</span></>}</td>
                <td>{pago
                  ? <span className="row" style={{ flexWrap: 'nowrap' }}><span className="chip ok">Pago em {dataLonga(dataDe(pago.pagoEm))}</span>
                    {pago.valor !== a.saldo && <span className="chip warn" title="Algum valor mudou depois do pagamento (ex.: gasto aprovado depois). Desfaça e marque de novo, acertando a diferença.">pago {reaisC(pago.valor)} · agora {reaisC(a.saldo)}</span>}<form action={desfazerPago.bind(null, m.id, mes, aqui)}><Enviar className="btn sm ghost">Desfazer</Enviar></form></span>
                  : a.viagens ? <form action={marcarPago.bind(null, m.id, mes, a.saldo, aqui)}><Enviar className="btn sm pri">Marcar como pago</Enviar></form> : <span className="muted small">sem viagens</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={5}>Ainda a pagar em {nomeMes(mes).toLowerCase()}</td><td className="r">{reaisC(tot)}</td><td /></tr></tfoot>
        </table></div>
        <p className="small muted">Se um valor mudar depois de marcado como pago (ex.: um gasto aprovado depois), desfaça e marque de novo.</p>
      </section>
    </>
  )
}
