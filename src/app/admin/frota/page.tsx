import Link from 'next/link'
import { Plus } from 'lucide-react'
import { config, caminhoes, manutencoes, viagensDoMes, mesesDisponiveis, motoristas } from '@/lib/dados'
import { agregar } from '@/lib/calc'
import { hoje, mesAtual, mesValido, nomeMes } from '@/lib/datas'
import { dataLonga, num, reais } from '@/lib/format'
import { FormModal } from '@/components/form-modal'
import { Cabecalho, Periodo, Vence } from '../ui'
import { camposCaminhao, camposManutencao } from '../campos'
import { salvarCaminhao, excluirCaminhao, salvarManutencao, excluirManutencao } from '../actions'

export const metadata = { title: 'Frota e manutenção' }

export default async function Frota(props: PageProps<'/admin/frota'>) {
  const sp = await props.searchParams
  const H = hoje(), atual = mesAtual()
  const mes = mesValido(sp.mes) && sp.mes <= atual ? sp.mes : atual
  const [cfg, cs, mn, vs, meses, ms] = await Promise.all([config(), caminhoes(), manutencoes(), viagensDoMes(mes), mesesDisponiveis(atual), motoristas()])
  const aqui = `/admin/frota${sp.mes ? `?mes=${mes}` : ''}`
  const sep = aqui.includes('?') ? '&' : '?'
  const ed = sp.editar ? (sp.editar === 'novo' ? 'novo' : cs.find((c) => c.id === Number(sp.editar))) : null
  const em = sp.manut ? (sp.manut === 'nova' ? 'nova' : mn.find((m) => m.id === Number(sp.manut))) : null
  const optC: [string, string][] = cs.map((c) => [String(c.id), c.placa])
  const doMes = mn.filter((m) => m.data.startsWith(mes))
  return (
    <>
      <Cabecalho titulo="Frota e manutenção" texto="Conjuntos, revisões, documentos e tudo o que foi gasto em oficina.">
        <Periodo meses={meses} mes={mes} base="/admin/frota" />
        <Link href={`${aqui}${sep}manut=nova`} scroll={false} className="btn pri"><Plus className="ico" />Lançar manutenção</Link>
        <Link href={`${aqui}${sep}editar=novo`} scroll={false} className="btn"><Plus className="ico" />Novo caminhão</Link>
      </Cabecalho>
      <section className="panel">
        <header><h2>Caminhões</h2></header>
        <div className="scroll"><table>
          <thead><tr><th>Cavalo</th><th>Carreta</th><th>Conjunto</th><th>Motorista</th><th className="r">Km atual</th><th className="r">Próxima revisão</th><th>Tacógrafo</th><th>Licenciamento</th><th className="r">Km/l no mês</th><th className="r">Manutenção no mês</th><th /></tr></thead>
          <tbody>
            {cs.map((c) => {
              const a = agregar(vs.filter((v) => v.caminhaoId === c.id), cfg.retornoPct)
              const md = a.litros ? a.km / a.litros : 0
              const gasto = doMes.filter((m) => m.caminhaoId === c.id).reduce((s, m) => s + m.valor, 0)
              const falta = c.proximaRevisaoKm != null ? c.proximaRevisaoKm - c.km : null
              return (
                <tr key={c.id} style={c.ativo ? undefined : { opacity: 0.55 }}>
                  <td><span className="plate">{c.placa}</span></td><td>{c.placaCarreta ? <span className="plate">{c.placaCarreta}</span> : '—'}</td>
                  <td>{c.descricao}{c.ano ? ` · ${c.ano}` : ''}{!c.ativo && <span className="chip"> parado</span>}</td>
                  <td>{ms.find((m) => m.caminhaoId === c.id)?.nome ?? <span className="muted">—</span>}</td>
                  <td className="r">{num(c.km)}</td>
                  <td className="r">{falta == null ? '—' : falta <= cfg.kmAvisoRevisao ? <span className={`chip ${falta <= cfg.kmAvisoRevisao / 2.5 ? 'bad' : 'warn'}`}>{falta < 0 ? `passou ${num(-falta)} km` : `faltam ${num(falta)} km`}</span> : `em ${num(falta)} km`}</td>
                  <td><Vence d={c.tacografoAte} hoje={H} aviso={cfg.diasAviso} urgente={cfg.diasUrgente} /></td>
                  <td><Vence d={c.licenciamentoAte} hoje={H} aviso={cfg.diasAviso} urgente={cfg.diasUrgente} /></td>
                  <td className="r">{md ? num(md, 2) : '—'} {md && md < c.metaConsumo ? <span className="chip warn">meta {num(c.metaConsumo, 1)}</span> : null}</td>
                  <td className="r">{reais(gasto)}{a.km ? <><br /><span className="small muted">R$ {num(gasto / 100 / a.km, 2)}/km</span></> : null}</td>
                  <td><Link href={`${aqui}${sep}editar=${c.id}`} scroll={false} className="btn sm">Editar</Link></td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </section>
      <section className="panel">
        <header><h2>Manutenções de {nomeMes(mes).toLowerCase()}</h2><b className="tnum">{reais(doMes.reduce((s, m) => s + m.valor, 0))}</b></header>
        {doMes.length ? (
          <div className="scroll"><table>
            <thead><tr><th>Data</th><th>Caminhão</th><th>Tipo</th><th>Descrição</th><th className="r">Valor</th><th /></tr></thead>
            <tbody>{doMes.map((m) => (
              <tr key={m.id}>
                <td>{dataLonga(m.data)}</td><td><span className="plate">{cs.find((c) => c.id === m.caminhaoId)?.placa}</span></td>
                <td><span className="chip">{m.tipo}</span>{m.imprevisto && <> <span className="chip bad">Imprevisto</span></>}</td>
                <td className="wrap">{m.descricao}</td><td className="r">{reais(m.valor)}</td>
                <td><Link href={`${aqui}${sep}manut=${m.id}`} scroll={false} className="btn sm">Editar</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">Nenhuma manutenção lançada neste mês.</p>}
      </section>
      {ed && (
        <FormModal titulo={ed === 'novo' ? 'Novo caminhão' : `Editar ${ed.placa}`} campos={camposCaminhao}
          valores={ed === 'novo' ? { ativo: true, metaConsumo: 2.4, km: 0 } : ed} acao={salvarCaminhao.bind(null, ed === 'novo' ? null : ed.id, aqui)} fechar={aqui}
          excluir={ed === 'novo' ? undefined : excluirCaminhao.bind(null, ed.id, aqui)} />
      )}
      {em && (
        <FormModal titulo={em === 'nova' ? 'Lançar manutenção' : 'Editar manutenção'} campos={camposManutencao(optC)}
          valores={em === 'nova' ? { data: H, caminhaoId: String(cs[0]?.id ?? ''), tipo: 'Preventiva', imprevisto: false } : { ...em, caminhaoId: String(em.caminhaoId) }}
          acao={salvarManutencao.bind(null, em === 'nova' ? null : em.id, aqui)} fechar={aqui}
          excluir={em === 'nova' ? undefined : excluirManutencao.bind(null, em.id, aqui)} />
      )}
    </>
  )
}
