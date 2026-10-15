import * as Sentry from '@sentry/nextjs'
import { baseSentry } from './sentry-config'

// O provedor de OpenTelemetry é o do @vercel/otel (registrado antes, em instrumentation.ts);
// o Sentry não registra um concorrente e fica responsável pelos erros.
Sentry.init({ ...baseSentry(), enableOpenTelemetrySetup: false })
