'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Barra fina no topo enquanto uma página nova carrega. Começa ao clicar num link interno, ao enviar um filtro
 * ou quando algum componente avisa (evento "fg:navegando"); termina quando o endereço muda.
 * Avança rápido no início e vai desacelerando (nunca chega a 100% sozinha), como uma estimativa honesta.
 */
export function ProgressoNav() {
  const path = usePathname()
  const sp = useSearchParams()
  const [estado, setEstado] = useState<'parado' | 'indo' | 'fim'>('parado')
  const [valor, setValor] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const limite = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ativo = useRef(false)

  const parar = () => {
    if (timer.current) clearInterval(timer.current)
    if (limite.current) clearTimeout(limite.current)
    timer.current = null
  }
  const terminar = () => {
    if (!ativo.current) return
    ativo.current = false
    parar()
    setValor(1)
    setEstado('fim')
    setTimeout(() => { if (!ativo.current) { setEstado('parado'); setValor(0) } }, 420)
  }
  const comecar = () => {
    if (ativo.current) return
    ativo.current = true
    parar()
    setEstado('indo')
    setValor(0.08)
    requestAnimationFrame(() => setValor(0.25))
    timer.current = setInterval(() => setValor((v) => v + (0.92 - v) * 0.12), 400)
    limite.current = setTimeout(terminar, 15000) // nunca fica presa
  }

  // Fim: o endereço mudou.
  // biome-ignore lint/correctness/useExhaustiveDependencies: roda de propósito a cada troca de endereço (path, sp)
  useEffect(() => { terminar() }, [path, sp])

  // biome-ignore lint/correctness/useExhaustiveDependencies: ouvintes registrados uma vez; as funções só usam refs e setters estáveis
  useEffect(() => {
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement).closest?.('a')
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return
      if (url.pathname === location.pathname && url.search === location.search) return
      comecar()
    }
    const envio = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement
      if ((f.getAttribute('method') ?? 'get').toLowerCase() === 'get' && f.getAttribute('action')?.startsWith('/') && !f.getAttribute('action')?.startsWith('/api/')) comecar()
    }
    const aviso = () => comecar()
    document.addEventListener('click', clique, true)
    document.addEventListener('submit', envio, true)
    window.addEventListener('fg:navegando', aviso)
    window.addEventListener('popstate', aviso)
    return () => {
      document.removeEventListener('click', clique, true)
      document.removeEventListener('submit', envio, true)
      window.removeEventListener('fg:navegando', aviso)
      window.removeEventListener('popstate', aviso)
      parar()
    }
  }, [])

  return <div className="barra-nav" data-estado={estado} style={{ transform: `scaleX(${valor})` }} role="progressbar" aria-hidden={estado === 'parado'} aria-label="Carregando a página" />
}

/** Avisa a barra de progresso que uma navegação vai começar (ex.: antes de router.push). */
export const avisarNavegacao = () => window.dispatchEvent(new Event('fg:navegando'))
