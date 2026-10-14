'use client'
import { useState } from 'react'

const fmt = (c: number) => (c < 0 ? '−' : '') + 'R$ ' + Math.abs(Math.round(c / 100)).toLocaleString('pt-BR')
const fmt2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Barra 100%: para onde vai cada R$ 100 de frete. Toque numa faixa ou na legenda para ler o valor. */
export function Distribuicao({ fatias }: { fatias: { nome: string; valor: number; cor: string }[] }) {
  const [sel, setSel] = useState<number | null>(null)
  const tot = fatias.reduce((s, f) => s + Math.max(0, f.valor), 0) || 1
  const lucro = fatias.find((f) => f.nome === 'Lucro líquido' && f.valor > 0)
  const s = sel != null ? fatias[sel] : null
  return (
    <>
      <span className="lbl">Para onde vai cada R$ 100 de frete · toque numa faixa</span>
      <div className={'stackbar' + (s ? ' has' : '')} role="group" aria-label="Distribuição do faturamento">
        {fatias.map((f, i) => f.valor > 0 && (
          <button key={f.nome} type="button" style={{ flex: f.valor / tot, background: f.cor }} aria-pressed={sel === i}
            aria-label={`${f.nome}: ${fmt(f.valor)}`} title={f.nome} onClick={() => setSel(sel === i ? null : i)} />
        ))}
      </div>
      <p style={{ fontSize: 16, minHeight: '1.5em' }}>
        {s ? <><b style={{ color: 'var(--yt)', fontWeight: 500 }}>{s.nome}:</b> {fmt(s.valor)} no período, ou R$ {fmt2((s.valor / tot) * 100)} de cada R$ 100.</>
          : lucro ? <>De cada R$ 100 de frete, sobram <b style={{ color: 'var(--yt)', fontWeight: 500 }}>R$ {fmt2((lucro.valor / tot) * 100)}</b> de lucro.</>
            : 'Os custos passaram do faturamento neste período.'}
      </p>
      <div className="legend">
        {fatias.map((f, i) => f.valor > 0 && (
          <button key={f.nome} type="button" aria-pressed={sel === i} onClick={() => setSel(sel === i ? null : i)}>
            <i style={{ background: f.cor }} />{f.nome} · R$ {((f.valor / tot) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          </button>
        ))}
      </div>
    </>
  )
}

type Mes = { mes: string; rotulo: string; frete: number; lucro: number; parcial: boolean }

/** Faturamento e lucro líquido dos últimos meses, barras lado a lado sobre um único eixo em reais. */
export function Tendencia({ meses }: { meses: Mes[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 960, H = 300, padL = 84, padR = 8, padT = 14, padB = 34
  const max = Math.max(1, ...meses.map((m) => Math.max(m.frete, m.lucro)))
  const min = Math.min(0, ...meses.map((m) => m.lucro))
  const passo = escala(max - min)
  const topo = Math.ceil(max / passo) * passo, base = Math.floor(min / passo) * passo
  const y = (v: number) => padT + ((topo - v) / (topo - base)) * (H - padT - padB)
  const col = (W - padL - padR) / meses.length
  const bw = Math.min(26, col * 0.3)
  const ticks: number[] = []
  for (let v = base; v <= topo + 1; v += passo) ticks.push(v)
  const m = hover != null ? meses[hover] : null
  return (
    <div style={{ position: 'relative' }}>
      <div className="legend" style={{ marginBottom: 8 }}>
        <span className="row small" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--k1)' }} />Faturamento (frete)</span>
        <span className="row small" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--k8)' }} />Lucro líquido</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Faturamento e lucro líquido por mês" style={{ width: '100%', height: 'auto' }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--line2)' : 'var(--line)'} strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={13} fill="var(--muted)">{abrev(t)}</text>
          </g>
        ))}
        {meses.map((d, i) => {
          const cx = padL + col * i + col / 2
          return (
            <g key={d.mes} onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)} style={{ cursor: 'pointer' }}>
              <rect x={padL + col * i} y={padT} width={col} height={H - padT - padB} fill={hover === i ? 'rgba(126,166,255,.06)' : 'transparent'} />
              <Barra x={cx - bw - 1} w={bw} y0={y(0)} y1={y(d.frete)} cor="var(--k1)" opac={d.parcial ? 0.6 : 1} />
              <Barra x={cx + 1} w={bw} y0={y(0)} y1={y(d.lucro)} cor={d.lucro < 0 ? 'var(--k7)' : 'var(--k8)'} opac={d.parcial ? 0.6 : 1} />
              <text x={cx} y={H - 10} textAnchor="middle" fontSize={14} fill={hover === i ? 'var(--ink)' : 'var(--muted)'}>{d.rotulo}{d.parcial ? '*' : ''}</text>
            </g>
          )
        })}
      </svg>
      {m && (
        <div role="status" style={{ position: 'absolute', top: 30, left: `clamp(8px, calc(${((padL + col * hover! + col / 2) / W) * 100}% - 90px), calc(100% - 190px))`, width: 180, background: 'var(--road)', border: '1px solid var(--road3)', borderRadius: 8, padding: '8px 10px', fontSize: 13, pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
          <b>{m.rotulo}{m.parcial ? ' (parcial)' : ''}</b>
          <div className="row between"><span className="muted">Faturamento</span><span className="tnum">{fmt(m.frete)}</span></div>
          <div className="row between"><span className="muted">Lucro líquido</span><span className="tnum" style={{ color: m.lucro < 0 ? 'var(--bad)' : 'var(--good)' }}>{fmt(m.lucro)}</span></div>
          <div className="row between"><span className="muted">Margem</span><span className="tnum">{m.frete ? ((m.lucro / m.frete) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—'}</span></div>
        </div>
      )}
    </div>
  )
}

function Barra({ x, w, y0, y1, cor, opac }: { x: number; w: number; y0: number; y1: number; cor: string; opac: number }) {
  const h = Math.abs(y1 - y0)
  if (h < 0.5) return null
  const r = Math.min(4, h, w / 2)
  const cima = y1 < y0
  // ponta arredondada só no lado do valor; o lado da linha do zero fica reto
  const d = cima
    ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`
    : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`
  return <path d={d} fill={cor} opacity={opac} />
}

function escala(amplitude: number) {
  const bruto = amplitude / 4
  const p = Math.pow(10, Math.floor(Math.log10(bruto)))
  const n = bruto / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}
function abrev(c: number) {
  const v = c / 100
  if (Math.abs(v) >= 1000) return (v < 0 ? '−' : '') + 'R$ ' + Math.abs(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil'
  return 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}
