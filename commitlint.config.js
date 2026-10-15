// Padrão dos commits e do título do PR (que vira o commit na main, no "Squash and merge").
// Formato: tipo(escopo opcional): descrição em português, no imperativo.
// Ex.: "fix(motorista): corrigir data do gasto lançado sem sinal"
export default {
  extends: ['@commitlint/config-conventional'],
  helpUrl: 'https://github.com/Systen7/Sistema-FG/blob/main/AGENTS.md#3-padrão-de-commits-e-título-do-pr',
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'perf', 'refactor', 'style', 'test', 'docs', 'build', 'ci', 'chore', 'revert']],
    // Descrição em português começa com verbo no infinitivo, com ou sem maiúscula.
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
    // Rodapés como o link da sessão podem passar de 100 caracteres.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}
