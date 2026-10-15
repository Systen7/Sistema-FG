import Link from 'next/link'
import { Plus, Smartphone } from 'lucide-react'
import { config, motoristas, caminhoes, viagensDoMes, emAndamento, mesesDisponiveis } from '@/lib/dados'
import { agregar } from '@/lib/calc'
import { hoje, mesAtual, mesValido, nomeMes } from '@/lib/datas'
import { num, reais, telefone } from '@/lib/format'
import { FormModal } from '@/components/form-modal'
import { Cabecalho, Periodo, Placas, Vence } from '../ui'
import { camposMotorista } from '../campos'
import { salvarMotorista, excluirMotorista } from '../actions'
import { Acesso } from './acesso'

export const metadata = { title: 'Motoristas' }

export default async function Motoristas(props: PageProps<'/admin/motoristas'>) {
  const sp = await props.searchParams
  const H = hoje(),
    atual = mesAtual()
  const mes = mesValido(sp.mes) && sp.mes <= atual ? sp.mes : atual
  const [cfg, ms, cs, vs, and, meses] = await Promise.all([config(), motoristas(), caminhoes(), viagensDoMes(mes), emAndamento(), mesesDisponiveis(atual)])
  const aqui = `/admin/motoristas${sp.mes ? `?mes=${mes}` : ''}`
  const sep = aqui.includes('?') ? '&' : '?'
  const ed = sp.editar ? (sp.editar === 'novo' ? 'novo' : ms.find((m) => m.id === Number(sp.editar))) : null
  const ac = sp.acesso ? ms.find((m) => m.id === Number(sp.acesso)) : null
  const optC: [string, string][] = cs.map((c) => [String(c.id), `${c.placa} · ${c.descricao}`])
  return (
    <>
      <Cabecalho titulo="Motoristas" texto="Cadastro, acesso ao app e resultado de cada motorista no período.">
        <Periodo meses={meses} mes={mes} base="/admin/motoristas" />
        <Link href={`${aqui}${sep}editar=novo`} scroll={false} className="btn pri">
          <Plus className="ico" />
          Novo motorista
        </Link>
      </Cabecalho>
      <section className="panel">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Motorista</th>
                <th>Cavalo e carreta</th>
                <th className="r">Comissão</th>
                <th>CNH</th>
                <th>Toxicológico</th>
                <th className="r">Viagens</th>
                <th className="r">Frete</th>
                <th className="r">Comissão ganha</th>
                <th className="r">Deixou de ganhar</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ms.map((m) => {
                const a = agregar(
                  vs.filter((v) => v.motoristaId === m.id),
                  cfg.retornoPct,
                )
                return (
                  <tr key={m.id} style={m.ativo ? undefined : { opacity: 0.55 }}>
                    <td>
                      <b>{m.nome}</b>
                      {!m.ativo && <span className="chip"> inativo</span>}
                      {and.some((v) => v.motoristaId === m.id) && (
                        <>
                          {' '}
                          <span className="chip run">Em viagem</span>
                        </>
                      )}
                      <br />
                      <span className="small muted">{telefone(m.telefone)}</span>
                    </td>
                    <td>
                      <Placas c={cs.find((c) => c.id === m.caminhaoId)} />
                    </td>
                    <td className="r">{num(m.comissaoPct, m.comissaoPct % 1 ? 1 : 0)}%</td>
                    <td>
                      <Vence d={m.cnhAte} hoje={H} aviso={cfg.diasAviso} urgente={cfg.diasUrgente} />
                    </td>
                    <td>
                      <Vence d={m.toxicologicoAte} hoje={H} aviso={cfg.diasAviso} urgente={cfg.diasUrgente} />
                    </td>
                    <td className="r">{a.n}</td>
                    <td className="r">{reais(a.frete)}</td>
                    <td className="r">{reais(a.comissao)}</td>
                    <td className="r">{reais(a.perdido)}</td>
                    <td>
                      <span className="row" style={{ flexWrap: 'nowrap' }}>
                        {m.ativo && (
                          <Link href={`${aqui}${sep}acesso=${m.id}`} scroll={false} className="btn sm">
                            <Smartphone className="ico" />
                            Acesso
                          </Link>
                        )}
                        <Link href={`${aqui}${sep}editar=${m.id}`} scroll={false} className="btn sm">
                          Editar
                        </Link>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Resultado de {nomeMes(mes).toLowerCase()}. “Deixou de ganhar”: comissão estimada sobre os km rodados vazios, com frete de retorno a {cfg.retornoPct}%
          do valor por km da ida (ajuste em Alertas › Regras).
        </p>
      </section>
      {ed && (
        <FormModal
          titulo={ed === 'novo' ? 'Novo motorista' : `Editar ${ed.nome}`}
          campos={camposMotorista(optC, ed === 'novo')}
          valores={
            ed === 'novo'
              ? { comissaoPct: 10, ativo: true, caminhaoId: '' }
              : { ...ed, telefone: telefone(ed.telefone), caminhaoId: ed.caminhaoId ? String(ed.caminhaoId) : '' }
          }
          acao={salvarMotorista.bind(null, ed === 'novo' ? null : ed.id, aqui)}
          fechar={aqui}
          excluir={ed === 'novo' ? undefined : excluirMotorista.bind(null, ed.id, aqui)}
        />
      )}
      {ac && <Acesso id={ac.id} nome={ac.nome} telefone={ac.telefone} fechar={aqui} empresa={cfg.nomeEmpresa} />}
    </>
  )
}
