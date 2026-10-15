'use client'
import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { ArrowLeft, Play, Repeat, CalendarDays, ArrowDownUp } from 'lucide-react'
import { CampoValor } from '@/components/valor'
import { dataLonga, num } from '@/lib/format'
import { iniciarViagem } from '../actions'

type Rota = { origem: string; destino: string; carga: string }

export function IniciarForm({
  hoje,
  km,
  placa,
  comissao,
  rotas,
  cidades,
  cargas,
}: {
  hoje: string
  km: number
  placa: string
  comissao: number
  rotas: Rota[]
  cidades: string[]
  cargas: string[]
}) {
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [carga, setCarga] = useState('')
  const [frete, setFrete] = useState(0)
  const [semFrete, setSemFrete] = useState(false)
  const [kmIni, setKmIni] = useState(String(km))
  const [inicio, setInicio] = useState(hoje)
  const [outroDia, setOutroDia] = useState(false)
  const [erro, setErro] = useState<{ t: string; campo?: string } | null>(null)
  const [pend, start] = useTransition()
  const freteRef = useRef<HTMLInputElement>(null)

  const repetir = (r: Rota) => {
    setOrigem(r.origem)
    setDestino(r.destino)
    setCarga(r.carga)
    setErro(null)
    setTimeout(() => freteRef.current?.focus(), 50)
  }
  const enviar = () =>
    start(async () => {
      const f = new FormData()
      f.set('origem', origem)
      f.set('destino', destino)
      f.set('carga', carga)
      f.set('frete', String(frete / 100))
      f.set('semFrete', semFrete ? '1' : '0')
      f.set('km', kmIni)
      f.set('inicio', inicio)
      const r = await iniciarViagem(f)
      if (r?.erro) {
        setErro({ t: r.erro, campo: r.campo })
        navigator.vibrate?.(150)
      }
    })
  const inv = (c: string) => (erro?.campo === c ? true : undefined)

  return (
    <>
      <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
        <Link href="/m" className="btn sm ghost" aria-label="Voltar">
          <ArrowLeft className="ico" />
        </Link>
        <div className="grow">
          <h1 style={{ fontSize: 24 }}>Iniciar viagem</h1>
          <p className="small muted">
            Caminhão <span className="plate">{placa}</span>
          </p>
        </div>
      </div>

      {rotas.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <span className="lbl">Repetir uma rota recente</span>
          <div className="stack" style={{ gap: 8 }}>
            {rotas.map((r) => (
              <button key={r.origem + r.destino} type="button" className="acao" style={{ minHeight: 60, fontSize: 16 }} onClick={() => repetir(r)}>
                <Repeat className="ico" style={{ width: 22, height: 22 }} />
                <span>
                  {r.origem.split('/')[0]} → {r.destino.split('/')[0]}
                  <small>{r.carga}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <form
        className="stack"
        style={{ gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault()
          enviar()
        }}
        noValidate
      >
        <datalist id="cidades">
          {cidades.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <label className="campo">
          Saindo de
          <input
            name="origem"
            list="cidades"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            placeholder="Cidade/UF"
            autoComplete="off"
            aria-invalid={inv('origem')}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-8px 0' }}>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              setOrigem(destino)
              setDestino(origem)
            }}
            aria-label="Inverter origem e destino"
          >
            <ArrowDownUp className="ico" />
            Inverter
          </button>
        </div>
        <label className="campo">
          Indo para
          <input
            name="destino"
            list="cidades"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Cidade/UF"
            autoComplete="off"
            aria-invalid={inv('destino')}
          />
        </label>
        <label className="campo">
          Carga
          <input
            name="carga"
            value={carga}
            onChange={(e) => setCarga(e.target.value)}
            placeholder="Ex.: Soja 37 t"
            autoComplete="off"
            aria-invalid={inv('carga')}
          />
        </label>
        {cargas.length > 0 && (
          <div className="sug" role="group" aria-label="Cargas usadas antes">
            {cargas.map((c) => (
              <button key={c} type="button" onClick={() => setCarga(c)}>
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="campo">
          <span>Valor do frete</span>
          {!semFrete && <CampoValor ref={freteRef} id="frete" rotulo="Valor do frete em reais" centavos={frete} onChange={setFrete} />}
          <label className="row" style={{ gap: 10, fontSize: 16, color: 'var(--ink)', fontWeight: 500, minHeight: 44 }}>
            <input type="checkbox" checked={semFrete} onChange={(e) => setSemFrete(e.target.checked)} style={{ width: 24, height: 24, minHeight: 0 }} />
            Ainda não sei o valor (o escritório completa)
          </label>
          {!semFrete && frete > 0 && (
            <span className="dica">
              Sua comissão: <b style={{ color: 'var(--yt)' }}>R$ {num(((frete / 100) * comissao) / 100, 2)}</b> ({num(comissao, comissao % 1 ? 1 : 0)}%)
            </span>
          )}
        </div>

        <label className="campo">
          Km no painel do caminhão
          <input
            name="km"
            inputMode="numeric"
            value={kmIni}
            onChange={(e) => setKmIni(e.target.value.replace(/\D/g, ''))}
            aria-invalid={inv('km')}
            style={{ fontSize: 22, fontWeight: 600 }}
          />
          <span className="dica">Último registrado: {num(km)} km. Confira e corrija se for diferente.</span>
        </label>

        {outroDia ? (
          <label className="campo">
            Data de saída
            <input type="date" value={inicio} max={hoje} onChange={(e) => setInicio(e.target.value || hoje)} />
          </label>
        ) : (
          <p className="row small muted" style={{ gap: 6 }}>
            <CalendarDays className="ico" />
            {inicio === hoje ? 'Saindo hoje' : `Saída em ${dataLonga(inicio)}`} ·
            <button type="button" className="linkbtn" onClick={() => setOutroDia(true)}>
              saiu em outro dia?
            </button>
          </p>
        )}

        {erro && (
          <p key={erro.t} className="aviso bad" role="alert">
            {erro.t}
          </p>
        )}
        <button type="submit" className="btn xl pri" disabled={pend} aria-busy={pend}>
          {pend ? <span className="spin" /> : <Play className="ico" />}
          {pend ? 'Iniciando…' : 'Iniciar viagem'}
        </button>
      </form>
    </>
  )
}
