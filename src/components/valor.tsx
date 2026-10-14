'use client'
import { forwardRef } from 'react'

/** Campo de dinheiro estilo caixa eletrônico: os números entram da direita (1 2 3 4 → 12,34). Só precisa do teclado numérico. */
export const CampoValor = forwardRef<HTMLInputElement, { centavos: number; onChange: (c: number) => void; id?: string; rotulo: string; autoFocus?: boolean }>(
  function CampoValor({ centavos, onChange, id, rotulo, autoFocus }, ref) {
    const txt = centavos ? (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
    return (
      <label className="valor" htmlFor={id}>
        <span aria-hidden>R$</span>
        <input
          ref={ref} id={id} aria-label={rotulo} inputMode="numeric" autoComplete="off" placeholder="0,00" value={txt} autoFocus={autoFocus}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9)
            onChange(d ? parseInt(d, 10) : 0)
          }}
        />
      </label>
    )
  },
)
