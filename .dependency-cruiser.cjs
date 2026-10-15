// Contratos de arquitetura. Rodar: npm run arquitetura
// Cada regra diz quem pode depender de quem; o CI falha se alguma for quebrada.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'sem-ciclos',
      severity: 'error',
      comment: 'Dependência circular deixa a ordem de carregamento imprevisível e o código difícil de separar.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'banco-isolado',
      severity: 'error',
      comment: 'src/db só descreve as tabelas e a conexão; não conhece regras nem telas.',
      from: { path: '^src/db' },
      to: { path: '^src/(app|lib|components)' },
    },
    {
      name: 'regras-nao-conhecem-telas',
      severity: 'error',
      comment: 'src/lib (regras, cálculos, autenticação) não importa nada de src/app nem de componentes visuais.',
      from: { path: '^src/lib' },
      to: { path: '^src/(app|components)' },
    },
    {
      name: 'componentes-nao-conhecem-paginas',
      severity: 'error',
      comment: 'Componentes compartilhados não dependem de uma página específica.',
      from: { path: '^src/components' },
      to: { path: '^src/app' },
    },
    {
      name: 'componentes-sem-banco',
      severity: 'error',
      comment: 'Componentes compartilhados recebem dados por props; quem consulta o banco é a página ou a ação.',
      from: { path: '^src/components' },
      to: { path: '^src/db' },
    },
    {
      name: 'cliente-so-com-cliente',
      severity: 'error',
      comment: 'Código que roda no celular (src/lib/cliente) não pode puxar banco, sessão nem nada do servidor.',
      from: { path: '^src/lib/cliente' },
      to: { path: '^src/(db|app|components)|^src/lib/(?!cliente/)' },
    },
    {
      name: 'cálculo-puro',
      severity: 'error',
      comment: 'Regras de cálculo são funções puras e testáveis: sem banco, sem rede, sem Next.',
      from: { path: '^src/lib/(calc|alertas|datas|format|fiscal|pneus)\\.ts$' },
      // Importar só tipos (import type) do schema é permitido: some na compilação.
      to: {
        path: '^src/(db|app|components)|^src/lib/(auth|dados|documentos|armazenamento|audit|acesso|obs)|^node_modules/(next|@vercel|postgres|drizzle-orm)',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'pagina-nao-importa-pagina',
      severity: 'error',
      comment: 'Área do escritório e app do motorista não importam código uma da outra; o que for comum vai para src/components ou src/lib.',
      from: { path: '^src/app/m/' },
      to: { path: '^src/app/admin/' },
    },
    {
      name: 'motorista-nao-importa-escritorio',
      severity: 'error',
      from: { path: '^src/app/admin/' },
      to: { path: '^src/app/m/' },
    },
    {
      name: 'testes-fora-do-sistema',
      severity: 'error',
      comment: 'Código do sistema nunca importa testes nem scripts.',
      from: { path: '^src' },
      to: { path: '^(tests|e2e|scripts)/' },
    },
    {
      name: 'sem-dependencia-de-desenvolvimento-em-producao',
      severity: 'error',
      comment: 'O que roda em produção só usa pacotes de "dependencies".',
      from: { path: '^src', pathNot: '\\.(test|spec)\\.tsx?$' },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'pacote-nao-declarado',
      severity: 'error',
      comment: 'Todo pacote importado precisa estar no package.json.',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown', 'unknown', 'undetermined'], pathNot: '^(node:|server-only)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(\\.next|node_modules|coverage|reports|\\.stryker-tmp)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
}
