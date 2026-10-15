'use client'
import { useEffect } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'

/** Tela amigável quando algo quebra ao montar a página. O erro vai para o Sentry (se ligado) e dá para tentar de novo. */
export function TelaErro({ error, reset, voltar }: { error: Error & { digest?: string }; reset: () => void; voltar: string }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) import('@sentry/nextjs').then((S) => S.captureException(error)).catch(() => {})
  }, [error])
  return (
    <section className="panel surge" role="alert" style={{ alignItems: 'flex-start' }}>
      <h2 className="row" style={{ gap: 8 }}><TriangleAlert className="ico" style={{ color: 'var(--warn)' }} />Não deu para abrir esta tela</h2>
      <p className="muted">Pode ser o sinal ou uma falha nossa. Tente de novo; se continuar, avise o escritório{error.digest ? <> com o código <b className="tnum">{error.digest}</b></> : null}.</p>
      <div className="row">
        <button type="button" className="btn pri" onClick={reset}><RotateCcw className="ico" />Tentar de novo</button>
        <a className="btn" href={voltar}>Voltar ao início</a>
      </div>
    </section>
  )
}
