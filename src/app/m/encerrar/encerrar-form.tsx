'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ArrowLeft, Flag, CalendarDays, Info } from 'lucide-react'
import { dataLonga, num, reais } from '@/lib/format'
import { encerrarViagem } from '../actions'

export function EncerrarForm(p: {
  id: number; origem: string; destino: string; kmInicial: number; inicio: string; hoje: string; frete: number; comissao: number; gastos: number; pendentes: number
}) {
  const [kmFinal, setKmFinal] = useState('')
  const [vazio, setVazio] = useState<boolean | null>(null)
  const [kmVazio, setKmVazio] = useState('')
  const [fim, setFim] = useState(p.hoje)
  const [outroDia, setOutroDia] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState('')
  const [pend, start] = useTransition()
  const kf = Number(kmFinal) || 0
  const rodado = kf > p.kmInicial ? kf - p.kmInicial : 0

  const revisar = () => {
    setErro('')
    if (!kf) return setErro('Digite o km do painel na chegada.')
    if (kf <= p.kmInicial) return setErro(`O km final precisa ser maior que ${num(p.kmInicial)}, o km da saída.`)
    if (vazio === null) return setErro('Diga se rodou vazio em alguma parte do caminho.')
    if (vazio && (!Number(kmVazio) || Number(kmVazio) >= rodado)) return setErro('Digite quantos km rodou vazio (menos que o total da viagem).')
    setConfirmar(true)
  }
  const enviar = () => start(async () => {
    const f = new FormData()
    f.set('kmFinal', kmFinal); f.set('voltouVazio', vazio ? '1' : '0'); f.set('kmVazio', kmVazio); f.set('fim', fim)
    const r = await encerrarViagem(f)
    if (r?.erro) { setErro(r.erro); setConfirmar(false) }
  })

  return (
    <>
      <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
        <Link href="/m" className="btn sm ghost" aria-label="Voltar"><ArrowLeft className="ico" /></Link>
        <div className="grow">
          <h1 style={{ fontSize: 24 }}>Encerrar viagem</h1>
          <p className="small muted">Viagem {p.id} · {p.origem.split('/')[0]} → {p.destino.split('/')[0]}</p>
        </div>
      </div>

      <form className="stack" style={{ gap: 18 }} onSubmit={(e) => { e.preventDefault(); revisar() }} noValidate>
        <label className="campo">Km no painel agora
          <input inputMode="numeric" autoComplete="off" value={kmFinal} onChange={(e) => setKmFinal(e.target.value.replace(/\D/g, ''))} placeholder={`maior que ${num(p.kmInicial)}`} style={{ fontSize: 26, fontWeight: 600 }} autoFocus />
          <span className="dica">{rodado ? <>Você rodou <b style={{ color: 'var(--yt)' }}>{num(rodado)} km</b> nesta viagem</> : `Saiu com ${num(p.kmInicial)} km`}</span>
        </label>

        <div className="campo">
          <span>Rodou vazio em alguma parte? (ex.: foi buscar a carga sem nada)</span>
          <div className="duas" role="group">
            <button type="button" className="opcao" aria-pressed={vazio === false} onClick={() => setVazio(false)}>Não</button>
            <button type="button" className="opcao" aria-pressed={vazio === true} onClick={() => setVazio(true)}>Sim</button>
          </div>
        </div>
        {vazio && (
          <label className="campo">Quantos km rodou vazio?
            <input inputMode="numeric" autoComplete="off" value={kmVazio} onChange={(e) => setKmVazio(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 22, fontWeight: 600 }} />
          </label>
        )}

        {outroDia ? (
          <label className="campo">Data de chegada
            <input type="date" value={fim} min={p.inicio} max={p.hoje} onChange={(e) => setFim(e.target.value || p.hoje)} />
          </label>
        ) : (
          <p className="row small muted" style={{ gap: 6 }}><CalendarDays className="ico" />{fim === p.hoje ? 'Chegou hoje' : 'Chegada em ' + dataLonga(fim)} ·
            <button type="button" className="linkbtn" onClick={() => setOutroDia(true)}>chegou em outro dia?</button></p>
        )}

        <section className="panel" style={{ gap: 8 }}>
          <div className="list">
            <div><span>Frete</span><b className="tnum">{p.frete ? reais(p.frete) : 'a confirmar'}</b></div>
            <div><span>Sua comissão</span><b className="tnum" style={{ color: 'var(--yt)' }}>{p.frete ? reais(p.comissao) : '—'}</b></div>
            <div><span>Gastos lançados</span><b className="tnum">{reais(p.gastos)}</b></div>
          </div>
          {p.pendentes > 0 && <p className="small muted row" style={{ gap: 6, flexWrap: 'nowrap' }}><Info className="ico" />{p.pendentes} {p.pendentes === 1 ? 'gasto ainda aguarda' : 'gastos ainda aguardam'} aprovação. Tudo bem encerrar assim.</p>}
          <p className="small muted">Lembrou de algum gasto? <Link href="/m/gasto">Lance antes de encerrar</Link>.</p>
        </section>

        {erro && <p className="aviso bad" role="alert">{erro}</p>}
        <button className="btn xl pri"><Flag className="ico" />Encerrar viagem</button>
      </form>

      {confirmar && (
        <div className="sheet-ov" onClick={(e) => e.target === e.currentTarget && setConfirmar(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="conf-t">
            <span className="alca" />
            <h2 id="conf-t">Confere os números?</h2>
            <div className="list">
              <div><span>Km na chegada</span><b className="tnum">{num(kf)}</b></div>
              <div><span>Total rodado</span><b className="tnum">{num(rodado)} km</b></div>
              {vazio && <div><span>Rodado vazio</span><b className="tnum">{num(Number(kmVazio))} km</b></div>}
              <div><span>Chegada</span><b>{dataLonga(fim)}</b></div>
            </div>
            {rodado > 4000 && <p className="aviso warn">{num(rodado)} km é bastante para uma viagem. Confira se o km final está certo.</p>}
            <p className="small muted">Depois de encerrada, só o escritório pode corrigir a viagem.</p>
            <div className="duas">
              <button type="button" className="btn xl" onClick={() => setConfirmar(false)}>Corrigir</button>
              <button type="button" className="btn xl pri" onClick={enviar} disabled={pend}>{pend ? <span className="spin" /> : null}Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
