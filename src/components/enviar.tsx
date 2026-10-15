'use client'
import { useFormStatus } from 'react-dom'

/**
 * Botão de envio que mostra que está processando enquanto a ação do formulário roda no servidor
 * (aprovar, recusar, marcar como pago…). Fica do mesmo tamanho: o texto continua, com um indicador ao lado.
 */
export function Enviar({ children, className = 'btn', title, ...resto }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus()
  return (
    <button {...resto} className={className} title={title} disabled={pending || resto.disabled} aria-busy={pending}>
      {pending && <span className="spin" aria-hidden />}
      {children}
    </button>
  )
}
