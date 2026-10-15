'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, Check, CloudOff, Trash2, X, CalendarDays } from 'lucide-react'
import { CampoValor } from '@/components/valor'
import { IconeTipo, NOME_TIPO } from '@/components/tipos'
import { enviarGasto, hojeLocal, novoId, reduzirFoto } from '@/lib/cliente/fila'
import { enviarComProgresso } from '@/lib/cliente/envio'
import { dataLonga, num } from '@/lib/format'

const TIPOS = ['Diesel', 'Pedágio', 'Alimentação', 'Borracharia', 'Chapa / descarga', 'Estadia', 'Arla 32', 'Outros']
const PAGA_EMPRESA = ['Diesel', 'Pedágio', 'Arla 32']
const OBS: Record<string, [string, string]> = {
  Diesel: ['Posto', 'Ex.: Posto Trevão, Rondonópolis'],
  Pedágio: ['Praça ou rodovia', 'Ex.: BR-163, km 94'],
}

type Editar = {
  id: number
  tipo: string
  valor: number
  litros: number | null
  km: number | null
  obs: string | null
  pagoPor: string
  data: string
  foto: string | null
  status: string
}

export function GastoForm({
  motoristaId,
  viagemId,
  rota,
  hoje: hojeServidor,
  inicio,
  editar,
}: {
  motoristaId: number
  viagemId: number
  rota: string
  hoje: string
  inicio: string
  editar: Editar | null
}) {
  // A tela pode ter sido aberta sem sinal a partir de uma cópia guardada; a data vale a do celular agora.
  const [hoje, setHoje] = useState(hojeServidor)
  useEffect(() => {
    setHoje(hojeLocal())
  }, [])
  const router = useRouter()
  const [tipo, setTipo] = useState<string | null>(editar?.tipo ?? null)
  const [valor, setValor] = useState(editar?.valor ?? 0)
  const [litros, setLitros] = useState(editar?.litros ? String(editar.litros).replace('.', ',') : '')
  const [km, setKm] = useState(editar?.km ? String(editar.km) : '')
  const [obs, setObs] = useState(editar?.obs ?? '')
  const [pago, setPago] = useState<'empresa' | 'motorista' | null>((editar?.pagoPor as 'empresa' | 'motorista') ?? null)
  const [data, setData] = useState(editar?.data ?? hojeServidor)
  const [outroDia, setOutroDia] = useState(false)
  const [foto, setFoto] = useState<Blob | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(editar?.foto ? `/api/fotos/${editar.foto}` : null)
  const [semFoto, setSemFoto] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState<number | null>(null)
  const [feito, setFeito] = useState<null | 'enviado' | 'na-fila'>(null)
  const [apagar, setApagar] = useState(false)
  const valorRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  useEffect(
    () => () => {
      if (fotoUrl?.startsWith('blob:')) URL.revokeObjectURL(fotoUrl)
    },
    [fotoUrl],
  )

  const escolher = (t: string) => {
    setTipo(t)
    setErro('')
    if (!editar) setPago(PAGA_EMPRESA.includes(t) ? 'empresa' : 'motorista')
    setTimeout(() => valorRef.current?.focus(), 60)
  }
  const litrosN = Number(litros.replace(/\./g, '').replace(',', '.')) || 0
  const precoLitro = tipo === 'Diesel' && litrosN > 0 && valor > 0 ? valor / 100 / litrosN : null

  const pegarFoto = async (f: File | undefined) => {
    if (!f) return
    const b = await reduzirFoto(f)
    setFoto(b)
    setSemFoto(false)
    setFotoUrl(URL.createObjectURL(b))
  }

  const enviar = async () => {
    setErro('')
    if (!tipo) return setErro('Escolha o tipo do gasto.')
    if (!valor) {
      valorRef.current?.focus()
      return setErro('Digite o valor.')
    }
    if (tipo === 'Diesel' && !litrosN) return setErro('Digite quantos litros abasteceu.')
    if (tipo === 'Diesel' && precoLitro && (precoLitro < 2 || precoLitro > 15)) {
      if (!confirm(`Deu R$ ${num(precoLitro, 2)} por litro. Os números estão certos?`)) return
    }
    if (!pago) return setErro('Diga quem pagou.')
    setEnviando(true)
    // Só mostra porcentagem quando há foto: sem ela o envio é instantâneo.
    const aoProgredir = foto ? (p: number) => setProgresso(p) : undefined
    try {
      if (editar) {
        const f = new FormData()
        f.set('tipo', tipo)
        f.set('valor', String(valor / 100))
        f.set('pagoPor', pago)
        f.set('obs', obs)
        f.set('data', data)
        if (tipo === 'Diesel') {
          f.set('litros', litros)
          f.set('kmAbastecimento', km)
        }
        if (foto) f.set('foto', foto, 'comprovante.jpg')
        if (semFoto) f.set('semFoto', '1')
        const r = await enviarComProgresso(`/api/m/despesas/${editar.id}`, f, aoProgredir, 'PATCH')
        if (r.rede) return setErro('Sem sinal agora. A correção precisa de internet; tente de novo daqui a pouco.')
        if (r.status >= 300) return setErro(typeof r.json.erro === 'string' ? r.json.erro : 'Não foi possível salvar.')
        navigator.vibrate?.(40)
        router.push(`/m?ok=${encodeURIComponent('Correção enviada para aprovação')}`)
        router.refresh()
        return
      }
      const r = await enviarGasto(
        {
          clientId: novoId(),
          motoristaId,
          viagemId,
          tipo,
          valor: String(valor / 100),
          litros: tipo === 'Diesel' ? litros : undefined,
          kmAbastecimento: tipo === 'Diesel' ? km : undefined,
          obs,
          pagoPor: pago,
          data: outroDia ? data : hojeLocal(),
          foto,
          criadoEm: Date.now(),
        },
        aoProgredir,
      )
      if (r.estado === 'erro') return setErro(r.erro)
      navigator.vibrate?.(r.estado === 'enviado' ? 40 : [40, 60, 40])
      setFeito(r.estado)
      // Sem sinal, não recarrega a tela: a tentativa falharia e o navegador mostraria a página de erro.
      if (r.estado === 'enviado') router.refresh()
    } finally {
      setEnviando(false)
      setProgresso(null)
    }
  }

  const excluir = async () => {
    if (!editar) return
    setEnviando(true)
    const r = await fetch(`/api/m/despesas/${editar.id}`, { method: 'DELETE' }).catch(() => null)
    setEnviando(false)
    if (!r) return setErro('Sem sinal agora. Tente de novo daqui a pouco.')
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setErro(j.erro ?? 'Não foi possível apagar.')
    router.push(`/m?ok=${encodeURIComponent('Gasto apagado')}`)
    router.refresh()
  }

  const recomecar = () => {
    setTipo(null)
    setValor(0)
    setLitros('')
    setKm('')
    setObs('')
    setPago(null)
    setData(hoje)
    setOutroDia(false)
    setFoto(null)
    setFotoUrl(null)
    setFeito(null)
    setErro('')
    window.scrollTo({ top: 0 })
  }

  if (feito)
    return (
      <div className="ok-grande surge">
        <div className="circ" style={feito === 'na-fila' ? { background: 'var(--y-soft)', color: 'var(--run-ink)' } : undefined}>
          {feito === 'enviado' ? <Check className="ico" /> : <CloudOff className="ico" />}
        </div>
        <h1>{feito === 'enviado' ? 'Gasto enviado' : 'Guardado no celular'}</h1>
        <p className="muted" style={{ maxWidth: '32ch' }}>
          {feito === 'enviado'
            ? `${NOME_TIPO[tipo!]} de R$ ${num(valor / 100, 2)} foi para o escritório aprovar.`
            : 'Você está sem sinal. O gasto fica guardado e é enviado sozinho quando a internet voltar. Não precisa lançar de novo.'}
        </p>
        <div className="stack" style={{ width: '100%', marginTop: 12 }}>
          <button type="button" className="btn xl pri" onClick={recomecar}>
            Lançar outro gasto
          </button>
          <Link className="btn xl" href="/m">
            Voltar para a viagem
          </Link>
        </div>
      </div>
    )

  return (
    <>
      <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
        <Link href="/m" className="btn sm ghost" aria-label="Voltar">
          <ArrowLeft className="ico" />
        </Link>
        <div className="grow">
          <h1 style={{ fontSize: 24 }}>{editar ? 'Corrigir gasto' : 'Lançar gasto'}</h1>
          <p className="small muted">
            Viagem {viagemId} · {rota}
          </p>
        </div>
      </div>

      {!tipo ? (
        <section className="stack surge">
          <h2>Que tipo de gasto?</h2>
          <div className="tiles">
            {TIPOS.map((t) => (
              <button key={t} type="button" className="tile" onClick={() => escolher(t)}>
                <IconeTipo tipo={t} />
                {NOME_TIPO[t]}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <form
          className="stack surge"
          style={{ gap: 18 }}
          onSubmit={(e) => {
            e.preventDefault()
            enviar()
          }}
          noValidate
        >
          <button
            type="button"
            className="tile"
            aria-pressed="true"
            onClick={() => !editar && setTipo(null)}
            style={{ minHeight: 0, flexDirection: 'row', alignItems: 'center' }}
            disabled={!!editar}
          >
            <IconeTipo tipo={tipo} />
            <span className="grow">{NOME_TIPO[tipo]}</span>
            {!editar && (
              <span className="small muted" style={{ fontWeight: 500 }}>
                Trocar
              </span>
            )}
          </button>

          {tipo === 'Diesel' && (
            <label className="campo">
              Quantos litros?
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder="Ex.: 550"
                value={litros}
                onChange={(e) => setLitros(e.target.value.replace(/[^\d,]/g, ''))}
                style={{ fontSize: 26, fontWeight: 600 }}
              />
            </label>
          )}

          <div className="campo">
            <span>{tipo === 'Diesel' ? 'Valor total pago' : 'Quanto custou?'}</span>
            <CampoValor ref={valorRef} id="valor" rotulo="Valor em reais" centavos={valor} onChange={setValor} />
            {precoLitro && (
              <span className="dica">
                Deu <b>R$ {num(precoLitro, 2)}</b> por litro
              </span>
            )}
          </div>

          <div className="campo">
            <span>Quem pagou?</span>
            <div className="duas" role="group" aria-label="Quem pagou">
              <button type="button" className="opcao" aria-pressed={pago === 'empresa'} onClick={() => setPago('empresa')}>
                Empresa<small>cartão, tag ou faturado</small>
              </button>
              <button type="button" className="opcao" aria-pressed={pago === 'motorista'} onClick={() => setPago('motorista')}>
                Do meu bolso<small>entra no seu acerto</small>
              </button>
            </div>
          </div>

          <div className="campo">
            <span>Foto do comprovante {pago === 'motorista' ? '(ajuda a aprovar mais rápido)' : '(opcional)'}</span>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pegarFoto(e.target.files?.[0])} />
            {fotoUrl && !semFoto ? (
              <div className="foto tem">
                <img src={fotoUrl} alt="Comprovante" />
                <span className="grow">Foto anexada</span>
                <button type="button" className="btn sm" onClick={() => camRef.current?.click()}>
                  Trocar
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  aria-label="Remover foto"
                  onClick={() => {
                    setFoto(null)
                    setFotoUrl(null)
                    if (editar?.foto) setSemFoto(true)
                  }}
                >
                  <X className="ico" />
                </button>
              </div>
            ) : (
              <button type="button" className="foto" onClick={() => camRef.current?.click()}>
                <Camera className="ico" />
                <span>Tirar foto do comprovante</span>
              </button>
            )}
          </div>

          {tipo === 'Diesel' && (
            <label className="campo">
              Km do caminhão no abastecimento (opcional)
              <input inputMode="numeric" autoComplete="off" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))} />
            </label>
          )}

          <label className="campo">
            {OBS[tipo]?.[0] ?? 'Observação'} (opcional)
            <input value={obs} maxLength={200} placeholder={OBS[tipo]?.[1] ?? ''} onChange={(e) => setObs(e.target.value)} />
          </label>

          {outroDia ? (
            <label className="campo">
              Data do gasto
              <input type="date" value={data} min={inicio} max={hoje} onChange={(e) => setData(e.target.value || hoje)} />
            </label>
          ) : (
            <p className="row small muted" style={{ gap: 6 }}>
              <CalendarDays className="ico" />
              {data === hoje ? 'Gasto de hoje' : `Gasto de ${dataLonga(data)}`} ·
              <button type="button" className="linkbtn" onClick={() => setOutroDia(true)}>
                foi em outro dia?
              </button>
            </p>
          )}

          {erro && (
            <p key={erro} className="aviso bad" role="alert">
              {erro}
            </p>
          )}

          <button type="submit" className="btn xl pri" disabled={enviando} aria-busy={enviando}>
            {enviando ? <span className="spin" /> : <Check className="ico" />}
            {progresso != null ? `Enviando foto ${Math.round(progresso * 100)}%` : enviando ? 'Enviando…' : editar ? 'Salvar correção' : 'Enviar gasto'}
            {progresso != null && (
              <span
                className="progresso"
                role="progressbar"
                aria-label="Envio da foto"
                aria-valuenow={Math.round(progresso * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ transform: `scaleX(${progresso})` }} />
              </span>
            )}
          </button>

          {editar &&
            editar.status !== 'aprovada' &&
            (apagar ? (
              <div className="duas">
                <button type="button" className="btn lg" onClick={() => setApagar(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn lg del solid" onClick={excluir} disabled={enviando} aria-busy={enviando}>
                  {enviando && <span className="spin" />}
                  {enviando ? 'Apagando…' : 'Apagar mesmo'}
                </button>
              </div>
            ) : (
              <button type="button" className="btn lg del ghost" onClick={() => setApagar(true)}>
                <Trash2 className="ico" />
                Apagar este gasto
              </button>
            ))}
        </form>
      )}
    </>
  )
}
