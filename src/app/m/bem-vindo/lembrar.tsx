'use client'
import { useEffect } from 'react'

/** Guarda o celular no aparelho: se um dia precisar entrar de novo, só digita o PIN. */
export function LembrarTelefone({ tel }: { tel: string }) {
  useEffect(() => { try { localStorage.setItem('fg:telefone', tel) } catch {} }, [tel])
  return null
}
