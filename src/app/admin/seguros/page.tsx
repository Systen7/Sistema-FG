import Link from 'next/link'
import { Plus } from 'lucide-react'
import { config, apolices, custosFixos, motoristas, caminhoes, viagensDoMes } from '@/lib/dados'
import { agregar } from '@/lib/calc'
import { hoje, mesAtual, somaMeses, nomeMes } from '@/lib/datas'
import { num, reais } from '@/lib/format'
import { FormModal } from '@/components/form-modal'
import { Cabecalho, Vence } from '../ui'
import { camposApolice, camposFixo } from '../campos'
import { salvarApolice, excluirApolice, salvarFixo, excluirFixo } from '../actions'

export const metadata = { title: 'Seguros e custos fixos' }

export default async function Seguros(props: PageProps<'/admin/seguros'>) {
  const sp = await props.searchParams
  const H = hoje(),
    ant = somaMeses(mesAtual(), -1)
  const [cfg, ap, fx, ms, cs, vs] = await Promise.all([config(), apolices(), custosFixos(), motoristas(), caminhoes(), viagensDoMes(ant)])
  const ts = ap.reduce((s, x) => s + x.custoMensal, 0),
    tf = fx.reduce((s, x) => s + x.valorMensal, 0)
  const km = agregar(vs, cfg.retornoPct).km
  const aqui = '/admin/seguros'
  const e = String(sp.editar ?? '')
  const [tipo, idS] = e.split('-')
  const eAp = tipo === 'apolice' ? (idS === 'nova' ? 'nova' : ap.find((x) => x.id === Number(idS))) : null
  const eFx = tipo === 'fixo' ? (idS === 'novo' ? 'novo' : fx.find((x) => x.id === Number(idS))) : null
  const docs = [
    ...ms
      .filter((m) => m.ativo)
      .flatMap((m) => [
        ['CNH', m.nome, m.cnhAte, `/admin/motoristas?editar=${m.id}`],
        ['Exame toxicológico', m.nome, m.toxicologicoAte, `/admin/motoristas?editar=${m.id}`],
      ]),
    ...cs
      .filter((c) => c.ativo)
      .flatMap((c) => [
        ['Tacógrafo', c.placa, c.tacografoAte, `/admin/frota?editar=${c.id}`],
        ['Licenciamento', c.placa, c.licenciamentoAte, `/admin/frota?editar=${c.id}`],
      ]),
  ].sort((a, b) => String(a[2] ?? '9').localeCompare(String(b[2] ?? '9'))) as [string, string, string | null, string][]
  return (
    <>
      <Cabecalho titulo="Seguros e custos fixos" texto="Custos que existem mesmo com o caminhão parado. Entram no lucro líquido e no custo por km.">
        <Link href={`${aqui}?editar=apolice-nova`} scroll={false} className="btn pri">
          <Plus className="ico" />
          Nova apólice
        </Link>
        <Link href={`${aqui}?editar=fixo-novo`} scroll={false} className="btn">
          <Plus className="ico" />
          Novo custo fixo
        </Link>
      </Cabecalho>
      <section className="hero">
        <div className="minis">
          <div>
            <span className="lbl">Seguros por mês</span>
            <b>{reais(ts)}</b>
          </div>
          <div>
            <span className="lbl">Demais fixos por mês</span>
            <b>{reais(tf)}</b>
          </div>
          <div>
            <span className="lbl">Fixo por caminhão</span>
            <b>{reais((ts + tf) / (cs.filter((c) => c.ativo).length || 1))}</b>
          </div>
          <div>
            <span className="lbl">Fixo por km em {nomeMes(ant, true)}</span>
            <b>{km ? `R$ ${num((ts + tf) / 100 / km, 2)}` : '—'}</b>
          </div>
        </div>
      </section>
      <section className="panel">
        <header>
          <h2>Apólices</h2>
        </header>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Seguro</th>
                <th>Cobertura</th>
                <th>Vigência até</th>
                <th className="r">Custo mensal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ap.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.nome} {p.obrigatorio && <span className="chip run">Obrigatório</span>}
                  </td>
                  <td className="wrap">{p.cobertura}</td>
                  <td>
                    <Vence d={p.vigenciaAte} hoje={H} aviso={cfg.diasAviso} urgente={cfg.diasUrgente} />
                  </td>
                  <td className="r">{reais(p.custoMensal)}</td>
                  <td>
                    <Link href={`${aqui}?editar=apolice-${p.id}`} scroll={false} className="btn sm">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Confirme com seu corretor quais seguros são obrigatórios para a sua operação.</p>
      </section>
      <div className="cols">
        <section className="panel">
          <header>
            <h2>Demais custos fixos</h2>
          </header>
          <div className="list">
            {fx.map((f) => (
              <div key={f.id}>
                <span>{f.nome}</span>
                <span className="row">
                  <b className="tnum">{reais(f.valorMensal)}</b>
                  <Link href={`${aqui}?editar=fixo-${f.id}`} scroll={false} className="btn sm">
                    Editar
                  </Link>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <header>
            <h2>Documentos e vencimentos</h2>
          </header>
          <div className="list">
            {docs.map(([t, n, d, href]) => (
              <div key={t + n}>
                <span>
                  {t} · <span className="muted">{n}</span>
                </span>
                <span className="row">
                  <Vence d={d} hoje={H} aviso={cfg.diasAviso} urgente={cfg.diasUrgente} />
                  <Link href={href} className="btn sm">
                    Editar
                  </Link>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
      {eAp && (
        <FormModal
          titulo={eAp === 'nova' ? 'Nova apólice' : 'Editar apólice'}
          campos={camposApolice}
          valores={eAp === 'nova' ? { obrigatorio: false } : eAp}
          acao={salvarApolice.bind(null, eAp === 'nova' ? null : eAp.id, aqui)}
          fechar={aqui}
          excluir={eAp === 'nova' ? undefined : excluirApolice.bind(null, eAp.id, aqui)}
        />
      )}
      {eFx && (
        <FormModal
          titulo={eFx === 'novo' ? 'Novo custo fixo' : 'Editar custo fixo'}
          campos={camposFixo}
          valores={eFx === 'novo' ? {} : eFx}
          acao={salvarFixo.bind(null, eFx === 'novo' ? null : eFx.id, aqui)}
          fechar={aqui}
          excluir={eFx === 'novo' ? undefined : excluirFixo.bind(null, eFx.id, aqui)}
        />
      )}
    </>
  )
}
