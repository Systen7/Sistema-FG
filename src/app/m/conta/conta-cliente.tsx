'use client'
import { useEffect, useState, useTransition } from 'react'
import { Download, KeyRound, LogOut, Share, SquarePlus, Smartphone } from 'lucide-react'
import { trocarPin } from '../actions'

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/** Botão para instalar o app na tela inicial; no iPhone mostra o passo a passo. */
export function Instalar({ forte = false }: { forte?: boolean }) {
  const [evt, setEvt] = useState<BIP | null>(null)
  const [instalado, setInstalado] = useState(false)
  const [ios, setIos] = useState(false)
  useEffect(() => {
    setInstalado(window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIP) }
    window.addEventListener('beforeinstallprompt', h)
    const ok = () => setInstalado(true)
    window.addEventListener('appinstalled', ok)
    return () => { window.removeEventListener('beforeinstallprompt', h); window.removeEventListener('appinstalled', ok) }
  }, [])
  if (instalado) return forte ? <p className="aviso ok"><Smartphone className="ico" />O app já está na tela inicial do seu celular.</p> : null
  if (evt) return (
    <button className="acao pri" onClick={async () => { await evt.prompt(); const r = await evt.userChoice; if (r.outcome === 'accepted') setInstalado(true); setEvt(null) }}>
      <Download className="ico" /><span>Instalar o app no celular<small>Fica na tela inicial, como um aplicativo</small></span>
    </button>
  )
  if (ios) return (
    <section className="panel">
      <h2>Colocar o app na tela inicial</h2>
      <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <li>Abra este link no <b>Safari</b>.</li>
        <li>Toque em <Share className="ico" style={{ display: 'inline', verticalAlign: '-4px' }} /> <b>Compartilhar</b>, na barra de baixo.</li>
        <li>Toque em <SquarePlus className="ico" style={{ display: 'inline', verticalAlign: '-4px' }} /> <b>Adicionar à Tela de Início</b>.</li>
      </ol>
    </section>
  )
  return forte ? (
    <section className="panel">
      <h2>Colocar o app na tela inicial</h2>
      <p className="muted">No Chrome, toque nos três pontinhos ⋮ no canto de cima e depois em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p>
    </section>
  ) : null
}

export function TrocarPin() {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [pend, start] = useTransition()
  if (!aberto) return <button className="acao" onClick={() => setAberto(true)}><KeyRound className="ico" /><span>Trocar meu PIN<small>Os 4 números para entrar</small></span></button>
  return (
    <section className="panel">
      <h2>Trocar PIN</h2>
      <form className="stack" action={(f) => start(async () => { const r = await trocarPin(f); if (r?.erro) setErro(r.erro) })}>
        <label className="campo">PIN atual<input name="atual" type="password" inputMode="numeric" maxLength={4} autoComplete="current-password" required /></label>
        <label className="campo">Novo PIN (4 números)<input name="novo" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" required /></label>
        <label className="campo">Repita o novo PIN<input name="confirma" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" required /></label>
        {erro && <p className="err" role="alert">{erro}</p>}
        <div className="duas"><button type="button" className="btn lg" onClick={() => setAberto(false)}>Cancelar</button><button className="btn lg pri" disabled={pend}>Salvar</button></div>
      </form>
    </section>
  )
}

/** Sair: apaga as páginas guardadas para uso sem sinal, para o próximo usuário do celular não vê-las. */
export function Sair({ acao }: { acao: () => Promise<void> }) {
  const [pend, start] = useTransition()
  return (
    <button className="btn lg block ghost" disabled={pend} onClick={() => start(async () => {
      try { for (const k of await caches.keys()) if (k.startsWith('fg-paginas')) await caches.delete(k) } catch {}
      await acao()
    })}>
      <LogOut className="ico" />Sair deste celular
    </button>
  )
}
