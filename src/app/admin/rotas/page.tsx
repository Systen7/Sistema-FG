import { config, todasEncerradas } from '@/lib/dados'
import { calcViagem } from '@/lib/calc'
import { num, reais } from '@/lib/format'
import { Cabecalho, Valor, Vazio } from '../ui'

export const metadata = { title: 'Rotas' }

export default async function Rotas() {
  const cfg = await config()
  const vs = await todasEncerradas()
  const m = new Map<string, { k: string; n: number; frete: number; km: number; vazio: number; lucro: number; diesel: number; litros: number }>()
  for (const v of vs) {
    const k = `${v.origem} → ${v.destino}`, c = calcViagem(v, cfg.retornoPct)
    const r = m.get(k) ?? { k, n: 0, frete: 0, km: 0, vazio: 0, lucro: 0, diesel: 0, litros: 0 }
    r.n++; r.frete += v.frete; r.km += c.km ?? 0; r.vazio += v.kmVazio; r.lucro += c.lucro; r.diesel += c.diesel; r.litros += c.litros
    m.set(k, r)
  }
  const rs = [...m.values()].sort((a, b) => b.lucro / (b.frete || 1) - a.lucro / (a.frete || 1))
  return (
    <>
      <Cabecalho titulo="Rotas" texto="Quais rotas dão mais resultado, com todas as viagens encerradas. Margem antes de manutenção e custos fixos." />
      <section className="panel">
        {rs.length === 0 ? <Vazio>Ainda não há viagens encerradas.</Vazio> : (
          <div className="scroll"><table className="tabela-longa">
            <thead><tr><th>Rota</th><th className="r">Viagens</th><th className="r">Frete médio</th><th className="r">Receita por km</th><th className="r">Km/l</th><th className="r">Km vazio</th><th className="r">Lucro médio</th><th>Margem</th></tr></thead>
            <tbody>{rs.map((r) => {
              const mg = r.frete ? (r.lucro / r.frete) * 100 : 0
              return (
                <tr key={r.k}>
                  <td>{r.k}</td><td className="r">{r.n}</td><td className="r">{reais(r.frete / r.n)}</td><td className="r">R$ {r.km ? num(r.frete / 100 / r.km, 2) : '—'}</td>
                  <td className="r">{r.litros ? num(r.km / r.litros, 2) : '—'}</td><td className="r">{r.km ? num((r.vazio / r.km) * 100) : 0}%</td>
                  <td className="r"><Valor v={r.lucro / r.n} /></td>
                  <td><div className="row" style={{ flexWrap: 'nowrap' }}><div className="bar" style={{ flex: 1, minWidth: 100 }}><i className={mg < 0 ? 'n' : ''} style={{ width: `${Math.min(100, Math.abs(mg) * 1.6)}%` }} /></div><span className="tnum">{num(mg)}%</span></div></td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
        <p className="small muted">Rotas com retorno vazio tendem a ficar no fim da lista: o diesel da volta consome a margem da ida.</p>
      </section>
    </>
  )
}
