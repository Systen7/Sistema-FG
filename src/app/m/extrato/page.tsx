import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { exigirMotorista } from '@/lib/auth'
import { config, viagensDoMes } from '@/lib/dados'
import { acerto, agregar, calcViagem } from '@/lib/calc'
import { mesAtual, mesValido, nomeMes, somaMeses, dataDe } from '@/lib/datas'
import { dataCurta, dataLonga, num, reais, reaisC } from '@/lib/format'

export const metadata = { title: 'Meu extrato' }

export default async function Extrato(props: PageProps<'/m/extrato'>) {
  const m = await exigirMotorista()
  const sp = await props.searchParams
  const atual = mesAtual()
  const mes = mesValido(sp.mes) && sp.mes <= atual ? sp.mes : atual
  const cfg = await config()
  const vs = await viagensDoMes(mes, { motoristaId: m.id })
  const enc = vs.filter((v) => v.status === 'encerrada')
  const a = agregar(enc, cfg.retornoPct)
  const ac = acerto(enc, cfg.retornoPct)
  const [pago] = await db
    .select()
    .from(s.acertos)
    .where(and(eq(s.acertos.motoristaId, m.id), eq(s.acertos.mes, mes)))
  const meses = [0, 1, 2, 3, 4, 5].map((i) => somaMeses(atual, -i))

  return (
    <>
      <div>
        <h1>Meu extrato</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Só as suas viagens encerradas.
        </p>
      </div>
      <nav className="sug" aria-label="Mês">
        {meses.map((x) => (
          <Link
            key={x}
            href={`/m/extrato?mes=${x}`}
            className="btn sm"
            aria-current={x === mes ? 'page' : undefined}
            style={x === mes ? { background: 'var(--y)', borderColor: 'var(--y)', color: '#fff' } : undefined}
          >
            {nomeMes(x, true)}
          </Link>
        ))}
      </nav>

      <section className="trip">
        <div>
          <span className="lbl">Comissão em {nomeMes(mes).toLowerCase()}</span>
          <b className="tnum" style={{ display: 'block', fontSize: 46, fontWeight: 600, lineHeight: 1.1, color: 'var(--good)', marginTop: 4 }}>
            {reais(a.comissao)}
          </b>
        </div>
        <div className="kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div>
            <span className="lbl">Viagens</span>
            <b>{a.n}</b>
          </div>
          <div>
            <span className="lbl">Km</span>
            <b>{num(a.km)}</b>
          </div>
          <div>
            <span className="lbl">Km/l</span>
            <b>{a.litros ? num(a.km / a.litros, 2) : '—'}</b>
          </div>
        </div>
        {a.perdido > 0 && (
          <p className="aviso warn" style={{ fontSize: 15 }}>
            Você rodou {num(a.kmVazio)} km vazio. Com frete de retorno, teria ganho cerca de <b>&nbsp;{reais(a.perdido)}&nbsp;</b> a mais.
          </p>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Acerto do mês</h2>
          {pago ? <span className="chip ok">Pago em {dataLonga(dataDe(pago.pagoEm))}</span> : enc.length ? <span className="chip warn">A receber</span> : null}
        </header>
        <div className="list">
          <div>
            <span>Comissões</span>
            <span className="tnum">{reaisC(ac.comissao)}</span>
          </div>
          <div>
            <span>Reembolso de gastos do seu bolso</span>
            <span className="tnum">{reaisC(ac.reembolso)}</span>
          </div>
          <div>
            <span>Adiantamentos recebidos</span>
            <span className="tnum">{reaisC(-ac.adiantamento)}</span>
          </div>
          <div>
            <b>{ac.saldo >= 0 ? 'Saldo a receber' : 'Saldo a devolver'}</b>
            <b className="tnum" style={{ fontSize: 20, color: ac.saldo >= 0 ? 'var(--good)' : 'var(--bad)' }}>
              {reaisC(Math.abs(ac.saldo))}
            </b>
          </div>
        </div>
        <p className="small muted">Só entram gastos já aprovados pelo escritório.</p>
      </section>

      {enc.length === 0 ? (
        <p className="empty">Nenhuma viagem encerrada em {nomeMes(mes).toLowerCase()}.</p>
      ) : (
        <section className="stack">
          <h2>Viagens</h2>
          {enc.map((v) => {
            const c = calcViagem(v, cfg.retornoPct)
            return (
              <article key={v.id} className="panel" style={{ gap: 8 }}>
                <header>
                  <b style={{ fontSize: 18 }}>
                    {v.origem.split('/')[0]} → {v.destino.split('/')[0]}
                  </b>
                  <span className="small muted">
                    {dataCurta(v.inicio)} a {dataCurta(v.fim)}
                  </span>
                </header>
                <p className="small muted">
                  {v.carga} · {num(c.km)} km{v.kmVazio ? ` (${num(v.kmVazio)} vazio)` : ''}
                  {c.consumo ? ` · ${num(c.consumo, 2)} km/l` : ''}
                </p>
                <div className="list">
                  <div>
                    <span>Frete</span>
                    <span className="tnum">{v.frete ? reais(v.frete) : 'a confirmar'}</span>
                  </div>
                  <div>
                    <span>Sua comissão ({num(v.comissaoPct, v.comissaoPct % 1 ? 1 : 0)}%)</span>
                    <b className="tnum pos">{reais(c.comissao)}</b>
                  </div>
                  {c.perdido > 0 && (
                    <div>
                      <span>Deixou de ganhar (km vazio)</span>
                      <span className="tnum warnc">{reais(c.perdido)}</span>
                    </div>
                  )}
                  <div>
                    <span>Adiantamento</span>
                    <span className="tnum">{reais(v.adiantamento)}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}
      {vs.some((v) => v.status === 'andamento') && <p className="small muted">A viagem em andamento entra no extrato quando for encerrada.</p>}
    </>
  )
}
