'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Delete, MessageCircle, ShieldCheck } from 'lucide-react'
import { entrarAdmin, entrarMotorista } from './actions'

const LS = 'fg:telefone'
const mascara = (d: string) => {
  d = d.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function Login({ empresa, ajuda, demo, motivo }: { empresa: string; ajuda: string | null; demo: boolean; motivo: 'saiu' | 'link' | null }) {
  const [aba, setAba] = useState<'motorista' | 'admin'>('motorista')
  return (
    <main className="login">
      <div className="brand"><i>FG</i>{empresa}</div>
      <div className="tabs2" role="group" aria-label="Tipo de acesso">
        <button type="button" aria-pressed={aba === 'motorista'} onClick={() => setAba('motorista')}>Sou motorista</button>
        <button type="button" aria-pressed={aba === 'admin'} onClick={() => setAba('admin')}>Escritório</button>
      </div>
      {motivo === 'saiu' && <p className="aviso warn">Sua sessão foi encerrada. Entre de novo.</p>}
      {motivo === 'link' && <p className="aviso warn">Este link de acesso expirou ou foi trocado. Entre com celular e PIN, ou peça um novo link ao escritório.</p>}
      {aba === 'motorista' ? <Motorista ajuda={ajuda} /> : <Admin />}
      {demo && (
        <section className="panel">
          <span className="lbl">Acessos de demonstração</span>
          <p className="small muted">Escritório: usuário <b>admin</b>, senha <b>fg2026</b>. Motoristas: celular <b>(66) 90000-0001</b> com PIN <b>1111</b>; os outros terminam em 0002, 0003 e 0004, com PIN 2222, 3333 e 4444.</p>
        </section>
      )}
    </main>
  )
}

function Motorista({ ajuda }: { ajuda: string | null }) {
  const [tel, setTel] = useState('')
  const [lembrado, setLembrado] = useState(false)
  const [etapa, setEtapa] = useState<'tel' | 'pin'>('tel')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [tremer, setTremer] = useState(false)
  const [pend, start] = useTransition()
  const telRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const t = localStorage.getItem(LS)
      if (t) { setTel(mascara(t)); setLembrado(true); setEtapa('pin') }
    } catch {}
  }, [])

  const digitos = tel.replace(/\D/g, '')
  const avancar = () => {
    if (digitos.length < 10) { setErro('Digite o celular com DDD.'); telRef.current?.focus(); return }
    setErro(''); setEtapa('pin')
  }
  const enviar = (p: string) => start(async () => {
    try { localStorage.setItem(LS, digitos) } catch {}
    const r = await entrarMotorista(digitos, p)
    if (r?.erro) {
      setErro(r.erro); setPin(''); setTremer(true); setTimeout(() => setTremer(false), 400)
      navigator.vibrate?.(200)
    }
  })
  const tecla = (k: string) => {
    if (pend) return
    setErro('')
    if (k === 'apagar') return setPin((p) => p.slice(0, -1))
    const n = (pin + k).slice(0, 4)
    setPin(n)
    if (n.length === 4) enviar(n)
  }

  useEffect(() => {
    if (etapa !== 'pin') return
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) tecla(e.key)
      else if (e.key === 'Backspace') tecla('apagar')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  if (etapa === 'tel') return (
    <section key="tel" className="hero surge" style={{ gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 30 }}>Entrar</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 16 }}>Use o número de celular cadastrado no escritório.</p>
      </div>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); avancar() }}>
        <label className="campo" style={{ fontSize: 15 }}>Seu celular com DDD
          <input ref={telRef} className="inp" style={{ fontSize: 24, minHeight: 60, letterSpacing: '.02em' }} type="tel" inputMode="numeric" autoComplete="tel-national"
            placeholder="(00) 00000-0000" value={tel} onChange={(e) => setTel(mascara(e.target.value))} aria-invalid={!!erro} autoFocus />
        </label>
        {erro && <p className="err" role="alert">{erro}</p>}
        <button className="btn xl pri">Continuar</button>
      </form>
      {ajuda && <a className="btn lg ghost" href={ajuda}><MessageCircle className="ico" />Pedir ajuda ao escritório</a>}
    </section>
  )

  return (
    <section key="pin" className="hero surge" style={{ gap: 18 }}>
      <div className="row between">
        <div>
          <p className="lbl">Celular</p>
          <p style={{ fontSize: 20, fontWeight: 600 }} className="tnum">{tel}</p>
        </div>
        <button type="button" className="btn sm" onClick={() => { setEtapa('tel'); setPin(''); setErro(''); if (lembrado) { try { localStorage.removeItem(LS) } catch {} setLembrado(false) } }}>Trocar número</button>
      </div>
      <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
        <p style={{ fontSize: 18, fontWeight: 600 }}>Digite seu PIN</p>
        <div className={'pins' + (tremer ? ' erro' : '')} aria-label={`${pin.length} de 4 números digitados`}>
          {[0, 1, 2, 3].map((i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
        </div>
        <p className="err" role="alert" style={{ minHeight: 24, textAlign: 'center' }}>{pend ? <span className="muted">Entrando…</span> : erro}</p>
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => <button key={k} type="button" onClick={() => tecla(k)} aria-label={k}>{k}</button>)}
        <span />
        <button type="button" onClick={() => tecla('0')} aria-label="0">0</button>
        <button type="button" className="fn" onClick={() => tecla('apagar')} aria-label="Apagar"><Delete className="ico" style={{ margin: '0 auto', width: 28, height: 28 }} /></button>
      </div>
      <p className="small muted" style={{ textAlign: 'center' }}>Esqueceu o PIN? O escritório pode enviar um link de acesso pelo WhatsApp.</p>
      {ajuda && <a className="btn lg ghost" href={ajuda}><MessageCircle className="ico" />Pedir ajuda ao escritório</a>}
    </section>
  )
}

function Admin() {
  const [erro, setErro] = useState('')
  const [pend, start] = useTransition()
  return (
    <section className="hero">
      <h1 style={{ fontSize: 30 }}>Acesso do escritório</h1>
      <form className="stack" action={(f) => start(async () => {
        const r = await entrarAdmin(String(f.get('usuario') ?? ''), String(f.get('senha') ?? ''))
        if (r?.erro) setErro(r.erro)
      })}>
        <label className="campo">Usuário<input name="usuario" autoComplete="username" autoCapitalize="none" required /></label>
        <label className="campo">Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
        {erro && <p className="err" role="alert">{erro}</p>}
        <button className="btn lg pri" disabled={pend} aria-busy={pend}>{pend ? <span className="spin" /> : <ShieldCheck className="ico" />}{pend ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </section>
  )
}
