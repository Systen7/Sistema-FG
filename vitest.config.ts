import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Dois grupos de teste:
// - unidade: funções puras e contratos de arquitetura (rápidos, sem banco) → npm test
// - integracao: regras com PostgreSQL de verdade (TEST_DATABASE_URL) → npm run test:integracao
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/apoio/vazio.ts'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/app/**/route.ts', 'src/app/**/actions.ts'],
      exclude: ['src/lib/cliente/**'],
      reporter: ['text-summary', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
    },
    projects: [
      { extends: true, test: { name: 'unidade', include: ['tests/**/*.test.ts'], exclude: ['tests/integracao/**'] } },
      {
        extends: true,
        test: {
          name: 'integracao',
          include: ['tests/integracao/**/*.test.ts'],
          globalSetup: ['tests/integracao/preparar.ts'],
          setupFiles: ['tests/integracao/ambiente.ts'],
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
})
