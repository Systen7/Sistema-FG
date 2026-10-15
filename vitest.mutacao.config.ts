import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Usado só pelo Stryker (teste de mutação): apenas os testes de unidade das regras puras.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/apoio/vazio.ts'),
    },
  },
  test: { include: ['tests/**/*.test.ts'], exclude: ['tests/integracao/**', 'tests/arquitetura.test.ts'] },
})
