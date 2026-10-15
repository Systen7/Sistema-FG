import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { SpanStatusCode, trace } from '@opentelemetry/api'

// Logs estruturados (uma linha JSON por evento), com o traceId para cruzar com o trace no Datadog/New Relic.
type Nivel = 'info' | 'aviso' | 'erro'
type Dados = Record<string, unknown>

export function log(nivel: Nivel, msg: string, dados?: Dados) {
  const ctx = trace.getActiveSpan()?.spanContext()
  const linha = JSON.stringify({ nivel, msg, ...dados, traceId: ctx?.traceId, spanId: ctx?.spanId, hora: new Date().toISOString() })
  if (nivel === 'erro') console.error(linha)
  else if (nivel === 'aviso') console.warn(linha)
  else console.log(linha)
}

/** Erro tratado (o sistema seguiu em frente) que mesmo assim precisa aparecer no Sentry e nos logs. */
export function registrarErro(e: unknown, msg: string, dados?: Dados) {
  log('erro', msg, { ...dados, erro: e instanceof Error ? e.message : String(e) })
  Sentry.captureException(e, { extra: { msg, ...dados } })
}

const tracer = trace.getTracer('sistema-fg')

/** Mede uma operação como um span do OpenTelemetry (aparece no trace da requisição). */
export function medir<T>(nome: string, f: () => Promise<T>, atributos?: Record<string, string | number | boolean>): Promise<T> {
  return tracer.startActiveSpan(nome, { attributes: atributos }, async (span) => {
    try {
      return await f()
    } catch (e) {
      span.recordException(e as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw e
    } finally {
      span.end()
    }
  })
}
