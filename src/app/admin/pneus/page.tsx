import Link from 'next/link'
import { config, caminhoes, pneus } from '@/lib/dados'
import { EIXOS } from '@/lib/pneus'
import { num, reais } from '@/lib/format'
import { FormModal } from '@/components/form-modal'
import type { Pneu } from '@/db/schema'
import { Cabecalho } from '../ui'
import { camposPneu } from '../campos'
import { salvarPneu, trocarPneu } from '../actions'
import { Enviar } from '@/components/enviar'

export const metadata = { title: 'Pneus' }

export default async function Pneus(props: PageProps<'/admin/pneus'>) {
  const sp = await props.searchParams
  const [cfg, cs, todos] = await Promise.all([config(), caminhoes(), pneus()])
  const cam = cs.find((c) => c.id === Number(sp.caminhao)) ?? cs[0]
  if (!cam) return <Cabecalho titulo="Pneus" texto="Cadastre um caminhão em Frota para controlar os pneus." />
  const ps = todos.filter((p) => p.caminhaoId === cam.id)
  const aqui = `/admin/pneus?caminhao=${cam.id}`
  const sel = ps.find((p) => p.id === Number(sp.pneu))
  const ed = sp.editar ? ps.find((p) => p.id === Number(sp.editar)) : null
  const cls = (p: Pneu) => (p.sulco < cfg.sulcoMinimo ? 'bad' : p.sulco < cfg.sulcoMinimo + 3 ? 'warn' : '')
  const ck = (p: Pneu) => (p.km ? p.custo / 100 / p.km : 0)
  const lado = (ax: number, l: string) =>
    ps
      .filter((p) => EIXOS[ax] && p.eixo === EIXOS[ax][0] && p.lado === l)
      // De fora para dentro do caminhão: no lado esquerdo o externo vem primeiro; no direito, o interno.
      .sort((a, b) => {
        const primeiro = l === 'Esquerdo' ? 'externo' : 'interno'
        return Number(b.local === primeiro) - Number(a.local === primeiro)
      })
      .map((p) => (
        <Link
          key={p.id}
          href={`${aqui}&pneu=${p.id}`}
          scroll={false}
          className={`tyre ${cls(p)}`}
          aria-pressed={sel?.id === p.id}
          aria-label={`${p.eixo} ${p.lado} ${p.local}, sulco ${num(p.sulco, 1)} mm`}
          title={`${p.eixo} ${p.lado} ${p.local} · ${num(p.sulco, 1)} mm`}
        />
      ))
  const pos = (p: Pneu) => `${p.eixo} · ${p.lado}${p.local ? ` ${p.local}` : ''}`
  return (
    <>
      <Cabecalho titulo="Pneus" texto="Cada pneu por posição. Toque num pneu para ver, corrigir ou registrar troca e recapagem.">
        <form action="/admin/pneus">
          <select
            name="caminhao"
            defaultValue={cam.id}
            className="inp"
            style={{ width: 'auto', minHeight: 38, padding: '6px 10px' }}
            data-autosubmit
            aria-label="Caminhão"
          >
            {cs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.placa} · {c.descricao}
              </option>
            ))}
          </select>
        </form>
      </Cabecalho>
      <div className="cols">
        <section className="panel">
          <header>
            <h2>Mapa de posições</h2>
            <span className="row small">
              <span className="chip ok">bom</span>
              <span className="chip warn">atenção</span>
              <span className="chip bad">abaixo de {num(cfg.sulcoMinimo, 1)} mm</span>
            </span>
          </header>
          <div className="rig">
            {EIXOS.map(([n], ax) => (
              <div key={n} className={`axle${ax === 3 ? ' gap' : ''}`}>
                <span className="axn" style={{ textAlign: 'right' }}>
                  {n}
                </span>
                {lado(ax, 'Esquerdo')}
                <span className="shaft" />
                {lado(ax, 'Direito')}
                <span className="axn" />
              </div>
            ))}
          </div>
          <p className="small muted">Vista de cima, frente para cima. {ps.length} pneus: cavalo e carreta.</p>
        </section>
        <section className="panel">
          {sel ? (
            <>
              <header>
                <h2>{pos(sel)}</h2>
                <Link href={`${aqui}&pneu=${sel.id}&editar=${sel.id}`} scroll={false} className="btn sm">
                  Corrigir dados
                </Link>
              </header>
              <div className="pair">
                <div>
                  <span className="lbl">Sulco</span>
                  <b>{num(sel.sulco, sel.sulco % 1 ? 1 : 0)} mm</b>
                </div>
                <div>
                  <span className="lbl">Km rodado</span>
                  <b>{num(sel.km)}</b>
                </div>
                <div>
                  <span className="lbl">Recapagens</span>
                  <b>{sel.recapagens}</b>
                </div>
                <div>
                  <span className="lbl">Custo por km</span>
                  <b>R$ {num(ck(sel), 3)}</b>
                </div>
              </div>
              <p className={cls(sel) === 'bad' ? 'aviso bad' : cls(sel) === 'warn' ? 'aviso warn' : 'aviso ok'}>
                {cls(sel) === 'bad'
                  ? 'Trocar ou recapar agora. O limite legal é 1,6 mm.'
                  : cls(sel) === 'warn'
                    ? 'Programar recapagem na próxima parada.'
                    : 'Em boas condições.'}
              </p>
              <p className="small muted">Custo acumulado {reais(sel.custo)}.</p>
              <div className="row">
                <form action={trocarPneu.bind(null, sel.id, `${aqui}&pneu=${sel.id}`)}>
                  <input type="hidden" name="modo" value="recapar" />
                  <Enviar className="btn">Registrar recapagem</Enviar>
                </form>
                <form action={trocarPneu.bind(null, sel.id, `${aqui}&pneu=${sel.id}`)}>
                  <input type="hidden" name="modo" value="novo" />
                  <Enviar className="btn pri">Trocar por pneu novo</Enviar>
                </form>
              </div>
            </>
          ) : (
            <>
              <header>
                <h2>Resumo do conjunto</h2>
              </header>
              <div className="pair">
                <div>
                  <span className="lbl">Críticos</span>
                  <b style={{ color: 'var(--bad)' }}>{ps.filter((p) => cls(p) === 'bad').length}</b>
                </div>
                <div>
                  <span className="lbl">Atenção</span>
                  <b style={{ color: 'var(--warn)' }}>{ps.filter((p) => cls(p) === 'warn').length}</b>
                </div>
                <div>
                  <span className="lbl">Sulco médio</span>
                  <b>{num(ps.reduce((s, p) => s + p.sulco, 0) / (ps.length || 1), 1)} mm</b>
                </div>
                <div>
                  <span className="lbl">Custo médio por km</span>
                  <b>R$ {num(ps.reduce((s, p) => s + ck(p), 0) / (ps.length || 1), 3)}</b>
                </div>
              </div>
              <p className="muted">Toque num pneu no mapa para ver os detalhes.</p>
            </>
          )}
        </section>
      </div>
      {ed && (
        <FormModal
          titulo={`Corrigir ${pos(ed)}`}
          campos={camposPneu}
          valores={ed}
          acao={salvarPneu.bind(null, ed.id, `${aqui}&pneu=${ed.id}`)}
          fechar={`${aqui}&pneu=${ed.id}`}
        />
      )}
    </>
  )
}
