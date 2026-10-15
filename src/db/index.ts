import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> }

// Na Vercel cada função abre poucas conexões e passa pelo "pooler" do Neon, que não aceita
// comandos preparados; por isso prepare: false.
const client =
  globalForDb.pg ??
  postgres(process.env.DATABASE_URL ?? 'postgres://fg:fg@localhost:5432/fg', {
    max: process.env.VERCEL ? 3 : 10,
    prepare: false,
    idle_timeout: 20,
  })
globalForDb.pg = client

export const db = drizzle(client, { schema })
export { schema }
