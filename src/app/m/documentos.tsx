'use client'
import { useState } from 'react'
import { Copy, Check, FileText, ShieldCheck } from 'lucide-react'

type D = { id: number; tipo: string; numero: number; chave: string; situacao: string; temPdf: boolean }
const fmt = (c: string) => c.replace(/(\d{4})(?=\d)/g, '$1 ')

/** MDF-e e CT-e da viagem no celular: chave legível para a fiscalização, copiar e abrir o PDF. */
export function DocumentosViagem({ docs }: { docs: D[] }) {
  const [copiado, setCopiado] = useState<number | null>(null)
  const lista = docs.filter((d) => d.situacao !== 'cancelado').sort((a, b) => (a.tipo === 'mdfe' ? -1 : 1) - (b.tipo === 'mdfe' ? -1 : 1))
  if (!lista.length) return null
  return (
    <section className="panel">
      <header><h2 className="row" style={{ gap: 8 }}><ShieldCheck className="ico" style={{ color: 'var(--yt)' }} />Documentos da viagem</h2></header>
      <p className="small muted">Mostre para a fiscalização, se pedirem.</p>
      <div>
        {lista.map((d, i) => (
          <div key={d.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
            <span className="row between">
              <b>{d.tipo === 'mdfe' ? 'MDF-e' : 'CT-e'} nº {d.numero}</b>
              {d.tipo === 'mdfe' && <span className={'chip ' + (d.situacao === 'encerrado' ? 'ok' : 'run')}>{d.situacao === 'encerrado' ? 'Encerrado' : 'Em aberto'}</span>}
            </span>
            <span className="tnum" style={{ fontFamily: 'var(--mono)', fontSize: 15, letterSpacing: '.02em', lineHeight: 1.6, wordBreak: 'break-word' }}>{fmt(d.chave)}</span>
            <span className="duas">
              <button type="button" className="btn lg" style={{ padding: "12px 10px", minWidth: 0 }} onClick={async () => {
                try { await navigator.clipboard.writeText(d.chave); setCopiado(d.id); setTimeout(() => setCopiado(null), 2000) } catch {}
              }}>{copiado === d.id ? <Check className="ico" /> : <Copy className="ico" />}{copiado === d.id ? 'Copiada' : 'Copiar chave'}</button>
              {d.temPdf
                ? <a className="btn lg" style={{ padding: "12px 10px", minWidth: 0 }} href={`/api/documentos/${d.id}/pdf`} target="_blank" rel="noreferrer"><FileText className="ico" />Abrir PDF</a>
                : <span className="small muted" style={{ alignSelf: 'center' }}>PDF não enviado pelo escritório</span>}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
