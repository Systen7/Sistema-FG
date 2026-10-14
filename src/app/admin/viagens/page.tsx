import Link from 'next/link'
import { Plus, Download } from 'lucide-react'
import { config, viagensFiltradas, motoristas, caminhoes, mesesDisponiveis } from '@/lib/dados'
import { calcViagem } from '@/lib/calc'
import { hoje, mesAtual, mesValido, nomeMes } from '@/lib/datas'
import { dataCurta, num, reais } from '@/lib/format'
import { FormModal } from '@/components/form-modal'
import { Cabecalho, Placa, Valor, Vazio } from '../ui'
import { camposViagem } from '../campos'
import { salvarViagem } from '../actions'

export const metadata = { title: 'Viagens' }

export default async function Viagens(props: PageProps<'/admin/viagens'>) {
  const sp = await props.searchParams
  const status = sp.status === 'andamento' || sp.status === 'encerrada' ? sp.status : undefined
  const motoristaId = Number(sp.motorista) || undefined
  const mes = mesValido(sp.mes) ? sp.mes : undefined
  const [cfg, ms, cs, meses] = await Promise.all([config(), motoristas(), caminhoes(), mesesDisponiveis(mesAtual())])
  const vs = await viagensFiltradas({ status, motoristaId, mes })
  const q = new URLSearchParams(Object.entries({ status, motorista: motoristaId, mes }).filter(([, v]) => v).map(([k, v]) => [k, String(v)]))
  const aqui = '/admin/viagens' + (q.size ? '?' + q : '')
  const tot = vs.reduce((a, v) => { const c = calcViagem(v, cfg.retornoPct); a.frete += v.frete; a.desp += c.total; a.com += c.comissao; if (v.status === 'encerrada') a.lucro += c.lucro; return a }, { frete: 0, desp: 0, com: 0, lucro: 0 })
  const optM: [string, string][] = ms.map((m) => [String(m.id), m.nome]), optC: [string, string][] = cs.map((c) => [String(c.id), c.placa])

  return (
    <>
      <Cabecalho titulo="Viagens" texto="Todas as viagens de todos os motoristas. Clique numa viagem para ver as despesas, as fotos e corrigir o que precisar.">
        <a className="btn" href={`/api/admin/exportar?tipo=viagens${mes ? '&mes=' + mes : ''}`}><Download className="ico" />Planilha</a>
        <Link href={`${aqui}${q.size ? '&' : '?'}novo=1`} scroll={false} className="btn pri"><Plus className="ico" />Nova viagem</Link>
      </Cabecalho>

      <form className="row" action="/admin/viagens">
        <select name="status" defaultValue={status ?? ''} className="inp" style={{ width: 'auto', minHeight: 38, padding: '6px 10px' }} data-autosubmit aria-label="Situação">
          <option value="">Todas as situações</option><option value="andamento">Em viagem</option><option value="encerrada">Encerradas</option>
        </select>
        <select name="motorista" defaultValue={motoristaId ?? ''} className="inp" style={{ width: 'auto', minHeight: 38, padding: '6px 10px' }} data-autosubmit aria-label="Motorista">
          <option value="">Todos os motoristas</option>{ms.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <select name="mes" defaultValue={mes ?? ''} className="inp" style={{ width: 'auto', minHeight: 38, padding: '6px 10px' }} data-autosubmit aria-label="Mês de início">
          <option value="">Todos os meses</option>{meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
        </select>
        {q.size > 0 && <Link href="/admin/viagens" className="btn sm ghost">Limpar filtros</Link>}
      </form>

      <section className="panel">
        {vs.length === 0 ? <Vazio>Nenhuma viagem com estes filtros.</Vazio> : (
          <div className="scroll"><table>
            <thead><tr><th>Nº</th><th>Motorista</th><th>Caminhão</th><th>Rota e carga</th><th>Início</th><th className="r">Km</th><th className="r">Frete</th><th className="r">Despesas</th><th className="r">Comissão</th><th className="r">Lucro</th><th>Situação</th></tr></thead>
            <tbody>
              {vs.map((v) => {
                const c = calcViagem(v, cfg.retornoPct)
                const href = `/admin/viagens/${v.id}`
                return (
                  <tr key={v.id} className="click" data-href={href}>
                    <td><Link href={href}>{v.id}</Link></td>
                    <td>{ms.find((m) => m.id === v.motoristaId)?.nome}</td>
                    <td><Placa c={cs.find((x) => x.id === v.caminhaoId)} /></td>
                    <td className="wrap"><Link href={href} style={{ color: 'inherit', textDecoration: 'none' }}>{v.origem} → {v.destino}<br /><span className="small muted">{v.carga}</span></Link></td>
                    <td>{dataCurta(v.inicio)}{v.fim ? <span className="muted"> a {dataCurta(v.fim)}</span> : ''}</td>
                    <td className="r">{c.km != null ? num(c.km) : '—'}</td>
                    <td className="r">{v.frete ? reais(v.frete) : <span className="chip warn">a confirmar</span>}</td>
                    <td className="r">{reais(c.total)}{c.pendentes ? <><br /><span className="chip warn">{c.pendentes} pendente{c.pendentes > 1 ? 's' : ''}</span></> : null}</td>
                    <td className="r">{reais(c.comissao)}</td>
                    <td className="r">{v.status === 'encerrada' ? <Valor v={c.lucro} /> : <span className="muted">em aberto</span>}</td>
                    <td>{v.status === 'andamento' ? <span className="chip run">Em viagem</span> : <span className="chip">Encerrada</span>}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot><tr><td colSpan={6}>{vs.length} {vs.length === 1 ? 'viagem' : 'viagens'}</td><td className="r">{reais(tot.frete)}</td><td className="r">{reais(tot.desp)}</td><td className="r">{reais(tot.com)}</td><td className="r"><Valor v={tot.lucro} /></td><td /></tr></tfoot>
          </table></div>
        )}
      </section>

      {sp.novo && (
        <FormModal titulo="Nova viagem" campos={camposViagem(optM, optC)} acao={salvarViagem.bind(null, null, '#nova')} fechar={aqui}
          valores={{ motoristaId: ms[0]?.id, caminhaoId: ms[0]?.caminhaoId ?? cs[0]?.id, inicio: hoje(), status: 'andamento', kmInicial: cs.find((c) => c.id === ms[0]?.caminhaoId)?.km, kmVazio: 0 }} />
      )}
    </>
  )
}
