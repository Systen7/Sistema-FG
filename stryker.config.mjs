// Teste de mutação: o Stryker altera o código das regras de negócio (troca > por >=, + por -, apaga condições...)
// e confere se algum teste percebe. Mutante que "sobrevive" = teste fraco. Rodar: npm run mutacao
// Relatório em reports/mutation/index.html.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // O executor próprio do Stryker para Vitest ainda não funciona com o Vitest 5 (roda 0 testes por mutante);
  // o executor por comando roda a suíte inteira para cada mutante: mais lento, mas confiável.
  testRunner: 'command',
  commandRunner: { command: 'npx vitest run --config vitest.mutacao.config.ts --bail 1 --reporter dot' },
  // Só as funções puras de regra de negócio: é onde um erro de sinal ou de limite custa dinheiro.
  mutate: ['src/lib/calc.ts', 'src/lib/alertas.ts', 'src/lib/fiscal.ts', 'src/lib/datas.ts', 'src/lib/format.ts', 'src/lib/pneus.ts'],
  coverageAnalysis: 'off',
  concurrency: 4,
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  // break: abaixo disso o CI falha (hoje: 90%). Suba conforme os testes melhoram; nunca baixe para "passar".
  thresholds: { high: 90, low: 80, break: 85 },
}
