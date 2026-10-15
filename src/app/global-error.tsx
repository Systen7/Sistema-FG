'use client'
import { useEffect } from 'react'

// Último recurso: erro no layout raiz. Precisa do próprio <html>/<body> e de estilo inline.
export default function ErroGeral({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) import('@sentry/nextjs').then((S) => S.captureException(error)).catch(() => {})
  }, [error])
  return (
    <html lang="pt-BR">
      <body
        style={{
          background: '#05070c',
          color: '#e8edf7',
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100dvh',
          margin: 0,
          padding: 16,
        }}
      >
        <main style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>O sistema teve um problema</h1>
          <p style={{ color: '#9aa6bd', margin: 0 }}>Tente de novo. Se continuar, avise o escritório{error.digest ? ` com o código ${error.digest}` : ''}.</p>
          <button
            type="button"
            onClick={reset}
            style={{ padding: '14px 18px', borderRadius: 10, border: 0, background: '#2f6bff', color: '#fff', fontSize: 16, fontWeight: 600 }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  )
}
