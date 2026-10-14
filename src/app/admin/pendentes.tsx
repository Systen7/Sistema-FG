import Link from 'next/link'
import { Check, X, Camera } from 'lucide-react'
import type { Despesa, Viagem, Motorista } from '@/db/schema'
import { IconeTipo, NOME_TIPO } from '@/components/tipos'
import { dataCurta, num, reaisC } from '@/lib/format'
import { aprovarDespesa, recusarDespesa } from './actions'

/** Despesas aguardando aprovação, com foto, aprovar e recusar com motivo. */
export function Pendentes({ itens, motoristas, voltar, limite }: { itens: { d: Despesa; v: Viagem }[]; motoristas: Motorista[]; voltar: string; limite?: number }) {
  if (!itens.length) return <p className="muted">Nenhuma despesa esperando aprovação.</p>
  const nome = (id: number) => motoristas.find((m) => m.id === id)?.nome ?? '—'
  const lista = limite ? itens.slice(0, limite) : itens
  return (
    <div className="list">
      {lista.map(({ d, v }) => (
        <div key={d.id}>
          <span className="row" style={{ flexWrap: 'nowrap', gap: 12, alignItems: 'flex-start' }}>
            {d.fotoId
              ? <a href={`/api/fotos/${d.fotoId}`} target="_blank" rel="noreferrer" aria-label="Abrir foto do comprovante">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/fotos/${d.fotoId}`} alt="" className="foto-mini" loading="lazy" /></a>
              : <span className="foto-mini" style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)' }} title="Sem foto"><IconeTipo tipo={d.tipo} /></span>}
            <span>
              <b>{NOME_TIPO[d.tipo] ?? d.tipo} · {reaisC(d.valor)}</b>{d.litros ? <span className="muted"> · {num(d.litros)} L (R$ {num(d.valor / 100 / d.litros, 2)}/L)</span> : null}<br />
              <span className="small muted">
                {nome(v.motoristaId)} · <Link href={`/admin/viagens/${v.id}`}>viagem {v.id}</Link> · {dataCurta(d.data)} · {d.pagoPor === 'motorista' ? 'pago do bolso' : 'pago pela empresa'}
                {d.obs ? ' · ' + d.obs : ''}{!d.fotoId && <> · <Camera className="ico" style={{ display: 'inline', width: 13, height: 13, verticalAlign: '-2px' }} /> sem foto</>}
              </span>
            </span>
          </span>
          <span className="row">
            <form action={aprovarDespesa.bind(null, d.id, voltar)}><button className="btn sm ok"><Check className="ico" />Aprovar</button></form>
            <details style={{ position: 'relative' }}>
              <summary className="btn sm" style={{ listStyle: 'none' }}><X className="ico" />Recusar</summary>
              <form action={recusarDespesa.bind(null, d.id, voltar)} className="panel" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 5, width: 280, boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
                <label className="campo">Motivo (o motorista vê)<input name="motivo" placeholder="Ex.: valor diferente do comprovante" /></label>
                <button className="btn sm del solid">Confirmar recusa</button>
              </form>
            </details>
          </span>
        </div>
      ))}
      {limite && itens.length > limite && <div><Link href="/admin/aprovacoes">Ver as outras {itens.length - limite}</Link></div>}
    </div>
  )
}
