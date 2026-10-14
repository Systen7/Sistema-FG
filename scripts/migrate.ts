import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// Migração usa a conexão direta (sem pooler) quando existe, como a DATABASE_URL_UNPOOLED que o Neon cria na Vercel.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url && process.env.VERCEL) {
  console.warn('Banco ainda não ligado: crie o Neon na aba Storage da Vercel e publique de novo.')
  process.exit(0)
}
const client = postgres(url ?? 'postgres://fg:fg@localhost:5432/fg', { max: 1, onnotice: () => {} })
await migrate(drizzle(client), { migrationsFolder: './drizzle' })
await client.end()
console.log('Banco de dados atualizado.')
