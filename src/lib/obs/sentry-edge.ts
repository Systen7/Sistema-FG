import * as Sentry from '@sentry/nextjs'
import { baseSentry } from './sentry-config'

Sentry.init(baseSentry())
