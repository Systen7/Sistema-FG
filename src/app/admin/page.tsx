import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { config, viagensDoMes, emAndamento, pendentes, motoristas, caminhoes, manutencoes, apolices, custosFixos, lembretes, pneus, dispensados, mesesDisponiveis } from '@/lib/dados'
import { agregar, calcViagem, resultadoGeral } from '@/lib/calc'
import { calcAlertas } from '@/lib/alertas'
import { hoje, mesAtual, mesValido, nomeMes, somaMeses } from '@/lib/datas'
import { dataCurta, num, reais } from '@/lib/format'
import { Cabecalho, Periodo, Placa, Valor } from './ui'
import { Distribuicao, Tendencia } from './graficos'
import { Pendentes } from './pendentes'
import { dispensarAlerta } from './actions'

export const metadata = { title: 'Painel' }

export default async function Painel(props: PageProps<'/admin'>) {
  const sp = await props.searchParams
  const H = hoje(), atual = mesAtual()
  const mes = mesValido(sp.mes) && sp.mes <= atual ? sp.mes : atual
  const [cfg, ms, cs, mn, ap, fx, lb, pn, ds, pe, and, meses] = await Promise.all([
    config(), motoristas(), caminhoes(), manutencoes(), apolices(), custosFixos(), lembretes(), pneus(), dispensados(), pendentes(), emAndamento(), mesesDisponiveis(atual),
  ])
  const vs = await viagensDoMes(mes)
  const g = resultadoGeral(mes, H, vs, mn, ap, fx, cfg.retornoPct)
  const urg = calcAlertas(H, { motoristas: ms, caminhoes: cs, apolices: ap, lembretes: lb, pneus: pn, cfg }).filter((a) => a.urgente && !ds.has(a.chave))
  const primeiro = meses[meses.length - 1] ?? mes
  const ult = [5, 4, 3, 2, 1, 0].map((i) => somaMeses(mes, -i)).filter((m) => m >= primeiro)
  const tend = await Promise.all(ult.map(async (m) => {
    const r = resultadoGeral(m, H, await viagensDoMes(m), mn, ap, fx, cfg.retornoPct)
    return { mes: m, rotulo: nomeMes(m, true), frete: r.frete, lucro: r.lucro, parcial: m === atual }
  }))
  const porMot = ms.filter((m) => m.ativo).map((m) => ({ m, a: agregar(vs.filter((v) => v.motoristaId === m.id), cfg.retornoPct) })).sort((x, y) => y.a.lucroViagens - x.a.lucroViagens)
  const mx = Math.max(1, ...porMot.map((x) => Math.abs(x.a.lucroViagens)))
  const cam = (id: number) => cs.find((c) => c.id === id)
  const fatias = [
    ['Combustível', g.diesel], ['Pedágio', g.pedagio], ['Outras despesas de viagem', g.outros], ['Comissão dos motoristas', g.comissao],
    ['Manutenção e pneus', g.manutencao], ['Seguros', g.seguros], ['Demais custos fixos', g.fixos], ['Lucro líquido', Math.max(0, g.lucro)],
  ].map(([nome, valor], i) => ({ nome: nome as string, valor: valor as number, cor: `var(--k${i + 1})` }))

  return (
    <>
      <Cabecalho titulo="Painel" texto={mes === atual ? 'Resultado das viagens encerradas no mês. Seguros e custos fixos entram proporcionais aos dias já corridos.' : 'Resultado das viagens encerradas no mês.'}>
        <Periodo meses={meses} mes={mes} base="/admin" />
      </Cabecalho>

      <section className="hero">
        <div className="row between" style={{ alignItems: 'flex-end', gap: '18px 32px' }}>
          <div>
            <span className="lbl">Lucro líquido · {nomeMes(mes)}</span>
            <b className={'big' + (g.lucro < 0 ? ' negv' : '')}>{reais(g.lucro)}</b>
            <span>{g.frete ? num((g.lucro / g.frete) * 100, 1) : 0}% de {reais(g.frete)} faturados em {g.n} {g.n === 1 ? 'viagem' : 'viagens'}</span>
          </div>
          <div className="minis" style={{ flex: '1 1 380px', maxWidth: 580 }}>
            <div><span className="lbl">Custo por km</span><b>R$ {g.km ? num(g.custo / 100 / g.km, 2) : '0,00'}</b><span className="small muted">receita R$ {g.km ? num(g.frete / 100 / g.km, 2) : '0,00'}</span></div>
            <div><span className="lbl">Km rodado</span><b>{num(g.km)}</b><span className="small muted">{g.km ? num((g.kmVazio / g.km) * 100) : 0}% vazio</span></div>
            <div><span className="lbl">Consumo</span><b>{g.litros ? num(g.km / g.litros, 2) : '—'} km/l</b><span className="small muted">{num(g.litros)} litros</span></div>
          </div>
        </div>
        <Distribuicao fatias={fatias} />
      </section>

      <div className="cols">
        <section className="panel">
          <header><h2>Precisa de você agora</h2><Link href="/admin/aprovacoes" className="btn sm">Aprovações<ArrowRight className="ico" /></Link></header>
          <span className="lbl">Despesas para aprovar ({pe.length})</span>
          <Pendentes itens={pe} motoristas={ms} voltar="/admin" limite={4} />
          <span className="lbl">Alertas urgentes ({urg.length})</span>
          {urg.length ? (
            <div className="list">
              {urg.slice(0, 4).map((a) => (
                <div key={a.chave}>
                  <span>{a.texto}<br /><span className="chip bad">{a.detalhe}</span></span>
                  <span className="row">
                    <Link href={a.link} className="btn sm">Resolver</Link>
                    <form action={dispensarAlerta.bind(null, a.chave, '/admin')}><button className="btn sm ghost">Dispensar</button></form>
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="muted">Nenhum alerta urgente.</p>}
        </section>

        <section className="panel">
          <header><h2>Na estrada agora</h2><Link href="/admin/viagens?status=andamento" className="btn sm">Ver viagens<ArrowRight className="ico" /></Link></header>
          {and.length ? (
            <div className="list">
              {and.map((v) => {
                const c = calcViagem(v, cfg.retornoPct)
                return (
                  <Link key={v.id} href={`/admin/viagens/${v.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    <span>
                      <b>{ms.find((m) => m.id === v.motoristaId)?.nome}</b> <Placa c={cam(v.caminhaoId)} /><br />
                      {v.origem} → {v.destino}<br />
                      <span className="small muted">desde {dataCurta(v.inicio)} · frete {v.frete ? reais(v.frete) : 'a confirmar'} · despesas {reais(c.total)}{c.pendentes ? ` · ${c.pendentes} pendente${c.pendentes > 1 ? 's' : ''}` : ''}</span>
                    </span>
                    <ArrowRight className="ico muted" />
                  </Link>
                )
              })}
            </div>
          ) : <p className="muted">Nenhum caminhão em viagem.</p>}
        </section>
      </div>

      <section className="panel">
        <header><h2>Faturamento e lucro por mês</h2><span className="small muted">* mês em andamento, ainda parcial</span></header>
        <Tendencia meses={tend} />
      </section>

      <section className="panel">
        <header><h2>Resultado por motorista</h2><span className="small muted">lucro das viagens, antes de manutenção e custos fixos</span></header>
        <div className="scroll"><table>
          <thead><tr><th>Motorista</th><th>Caminhão</th><th className="r">Viagens</th><th className="r">Frete</th><th className="r">Comissão</th><th className="r">Km/l</th><th className="r">Km vazio</th><th>Lucro das viagens</th></tr></thead>
          <tbody>
            {porMot.map(({ m, a }) => {
              const c = cam(m.caminhaoId ?? 0), media = a.litros ? a.km / a.litros : 0
              return (
                <tr key={m.id}>
                  <td><Link href={`/admin/viagens?motorista=${m.id}&mes=${mes}`} style={{ color: 'inherit' }}>{m.nome}</Link></td>
                  <td><Placa c={c} /></td><td className="r">{a.n}</td><td className="r">{reais(a.frete)}</td><td className="r">{reais(a.comissao)}</td>
                  <td className="r">{media ? num(media, 2) : '—'} {c && media && media < c.metaConsumo ? <span className="chip warn">meta {num(c.metaConsumo, 1)}</span> : null}</td>
                  <td className="r">{a.km ? num((a.kmVazio / a.km) * 100) : 0}%</td>
                  <td><div className="row" style={{ flexWrap: 'nowrap' }}><div className="bar" style={{ flex: 1, minWidth: 90 }}><i className={a.lucroViagens < 0 ? 'n' : ''} style={{ width: `${(Math.abs(a.lucroViagens) / mx) * 100}%` }} /></div><Valor v={a.lucroViagens} /></div></td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </section>
    </>
  )
}
