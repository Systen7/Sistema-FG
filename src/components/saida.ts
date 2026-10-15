'use client'
import { useCallback, useRef, useState } from 'react'

/** Para janelas que somem: marca "saindo" (a animação de saída roda) e só então executa o fechamento. */
export function useSaida(duracaoMs = 160) {
  const [saindo, setSaindo] = useState(false)
  const ja = useRef(false)
  const sair = useCallback((depois: () => void) => {
    if (ja.current) return
    ja.current = true
    setSaindo(true)
    const reduzir = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setTimeout(() => { depois(); ja.current = false; setSaindo(false) }, reduzir ? 0 : duracaoMs)
  }, [duracaoMs])
  return { saindo, sair }
}
