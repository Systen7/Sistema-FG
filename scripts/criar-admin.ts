// Cria (ou redefine a senha de) um acesso do escritório. Uso: npm run db:admin -- usuario "Nome Completo" senha
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
// Carrega o .env quando existe (no computador); na Vercel as variáveis já vêm do painel.
try { process.loadEnvFile() } catch {}
import bcrypt from 'bcryptjs'
import * as s from '../src/db/schema'

const [usuario, nome, senha] = process.argv.slice(2)
if (!usuario || !nome || !senha || senha.length < 8) {
  console.error('Uso: npm run db:admin -- usuario "Nome Completo" senha   (senha com pelo menos 8 caracteres)')
  process.exit(1)
}
const client = postgres(process.env.DATABASE_URL ?? 'postgres://fg:fg@localhost:5432/fg', { max: 1 })
const db = drizzle(client, { schema: s })
await db.insert(s.configuracao).values({ id: 1 }).onConflictDoNothing()
const senhaHash = await bcrypt.hash(senha, 10)
await db.insert(s.administradores).values({ usuario: usuario.toLowerCase(), nome, senhaHash })
  .onConflictDoUpdate({ target: s.administradores.usuario, set: { nome, senhaHash } })
console.log(`Acesso do escritório pronto: usuário "${usuario.toLowerCase()}".`)
await client.end()
