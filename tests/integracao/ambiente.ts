// Antes de cada arquivo de teste: aponta o sistema para o banco de teste e simula os cookies do Next.
import { vi } from 'vitest'

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.SESSION_SECRET ??= 'segredo-dos-testes-de-integracao-0123456789'
delete process.env.BLOB_READ_WRITE_TOKEN // arquivos vão para o próprio banco
delete process.env.BLOB_STORE_ID

const pote = vi.hoisted(() => new Map<string, string>())
export const cookiesDoTeste = pote

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => (pote.has(n) ? { name: n, value: pote.get(n) } : undefined),
    set: (n: string, v: string) => void pote.set(n, v),
    delete: (n: string) => void pote.delete(n),
  }),
  headers: async () => new Headers(),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }))
