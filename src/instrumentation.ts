// Observabilidade do servidor. Ver "Observabilidade" no README.
// - OpenTelemetry (@vercel/otel): traces de cada requisição. Na Vercel vão para a integração instalada
//   (Datadog, New Relic, Grafana, Honeycomb...); fora dela, para OTEL_EXPORTER_OTLP_ENDPOINT. Sem nada configurado, não envia.
// - Sentry: erros do servidor e do edge, quando SENTRY_DSN existe.
import * as Sentry from '@sentry/nextjs'
import { registerOTel } from '@vercel/otel'

export async function register() {
  registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME || 'sistema-fg' })
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./lib/obs/sentry-node')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./lib/obs/sentry-edge')
}

export const onRequestError = Sentry.captureRequestError
