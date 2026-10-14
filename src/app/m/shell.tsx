'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Route, ReceiptText, UserRound, CloudOff, CloudUpload } from 'lucide-react'
import { aoMudar, listar, sincronizar } from '@/lib/cliente/fila'
import { toast } from '@/components/toast'

export function Abas() {
  const p = usePathname()
  const abas = [
    { href: '/m', nome: 'Viagem', Ico: Route, ativo: p === '/m' || ['/m/gasto', '/m/iniciar', '/m/encerrar'].some((x) => p.startsWith(x)) },
    { href: '/m/extrato', nome: 'Extrato', Ico: ReceiptText, ativo: p.startsWith('/m/extrato') },
    { href: '/m/conta', nome: 'Minha conta', Ico: UserRound, ativo: p.startsWith('/m/conta') },
  ]
  return (
    <nav className="m-tabs" aria-label="Menu">
      {abas.map(({ href, nome, Ico, ativo }) => (
        <Link key={href} href={href} aria-current={ativo ? 'page' : undefined}><Ico className="ico" />{nome}</Link>
      ))}
    </nav>
  )
}

/** Mostra se há sinal e quantos gastos esperam envio; envia sozinho quando o sinal volta. */
export function Rede() {
  const router = useRouter()
  const [online, setOnline] = useState(true)
  const [fila, setFila] = useState(0)
  useEffect(() => {
    const conta = async () => setFila((await listar()).length)
    const sync = async () => {
      const n = await sincronizar()
      if (n) { toast(n === 1 ? '1 gasto guardado foi enviado' : `${n} gastos guardados foram enviados`); if (navigator.onLine) router.refresh() }
    }
    const on = () => { setOnline(true); sync() }
    const off = () => setOnline(false)
    setOnline(navigator.onLine)
    conta(); sync()
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const visivel = () => { if (document.visibilityState === 'visible') sync() }
    document.addEventListener('visibilitychange', visivel)
    const t = setInterval(sync, 30000)
    const des = aoMudar(conta)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); document.removeEventListener('visibilitychange', visivel); clearInterval(t); des() }
  }, [router])
  if (!online) return <span className="net off" role="status"><CloudOff className="ico" />Sem sinal{fila ? ` · ${fila} guardado${fila > 1 ? 's' : ''}` : ''}</span>
  if (fila) return <span className="net fila" role="status"><CloudUpload className="ico" />Enviando {fila}</span>
  return <span className="net"><span className="dot" />Conectado</span>
}

export function RegistrarSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
    }
  }, [])
  return null
}
