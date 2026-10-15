// Roda uma vez antes dos testes de integração: confere o banco de teste e aplica as migrações.
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export default async function preparar() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('Defina TEST_DATABASE_URL (um banco só para testes, ex.: postgres://fg:fg@localhost:5432/fg_teste).')
  // Proteção: os testes apagam tudo entre um caso e outro. Nunca rodar num banco que não seja de teste.
  const nome = new URL(url).pathname.slice(1)
  if (!/test/i.test(nome)) throw new Error(`O banco "${nome}" não parece de teste: o nome precisa conter "test".`)
  const client = postgres(url, { max: 1, onnotice: () => {} })
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  await client.end()
}
