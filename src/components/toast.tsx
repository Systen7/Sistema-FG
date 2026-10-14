'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

// Mensagens curtas depois de uma ação. Vêm pela URL (?ok=...) para sobreviver ao redirecionamento.
export function Toast() {
  const sp = useSearchParams()
  const router = useRouter()
  const path = usePathname()
  const [msg, setMsg] = useState<{ t: string; tipo: 'ok' | 'bad' } | null>(null)
  useEffect(() => {
    const ok = sp.get('ok'), erro = sp.get('erro')
    if (!ok && !erro) return
    setMsg({ t: (ok ?? erro)!, tipo: ok ? 'ok' : 'bad' })
    if (ok) navigator.vibrate?.(40)
    const q = new URLSearchParams(sp.toString())
    q.delete('ok'); q.delete('erro')
    router.replace(path + (q.size ? '?' + q : ''), { scroll: false })
  }, [sp, router, path])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3200)
    return () => clearTimeout(t)
  }, [msg])
  useEffect(() => {
    const h = (e: Event) => setMsg((e as CustomEvent).detail)
    window.addEventListener('fg:toast', h)
    return () => window.removeEventListener('fg:toast', h)
  }, [])
  if (!msg) return null
  return (
    <div className={'toast ' + msg.tipo} role="status" aria-live="polite">
      {msg.tipo === 'ok' ? <CheckCircle2 className="ico" style={{ color: 'var(--good)' }} /> : <AlertTriangle className="ico" style={{ color: 'var(--bad)' }} />}
      {msg.t}
    </div>
  )
}

export function toast(t: string, tipo: 'ok' | 'bad' = 'ok') {
  window.dispatchEvent(new CustomEvent('fg:toast', { detail: { t, tipo } }))
}
