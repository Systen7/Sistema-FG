// Contratos de arquitetura e segurança que o dependency-cruiser não enxerga
// (ele não sabe o que é 'use client' nem o que uma função faz por dentro).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = path.resolve(__dirname, '..')
const SRC = path.join(RAIZ, 'src')

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n)
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}
const TODOS = arquivos(SRC)
const ler = (p: string) => readFileSync(p, 'utf8')
const rel = (p: string) => path.relative(RAIZ, p)
const diretiva = (codigo: string, d: string) => new RegExp(`^\\s*(//[^\\n]*\\n\\s*)*['"]${d}['"]`).test(codigo)

/** Imports locais (relativos ou @/) já resolvidos para arquivo; `import type` não conta, some na compilação. */
function importsLocais(arquivo: string): string[] {
  const codigo = ler(arquivo)
  const specs = [
    ...codigo.matchAll(/^\s*import\s+(?!type\b)(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/gm),
    ...codigo.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((m) => m[1])
  return specs.flatMap((s) => {
    const base = s.startsWith('@/') ? path.join(SRC, s.slice(2)) : s.startsWith('.') ? path.resolve(path.dirname(arquivo), s) : null
    if (!base) return []
    const achado = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => base + e).find((c) => existsSync(c) && statSync(c).isFile())
    return achado ? [achado] : []
  })
}

/** Caminho de imports que leva de `inicio` a um arquivo que só pode rodar no servidor. */
function caminhoAteServidor(inicio: string): string[] | null {
  const visto = new Set<string>()
  const fila: string[][] = [[inicio]]
  while (fila.length) {
    const cam = fila.shift()!
    const atual = cam[cam.length - 1]
    if (visto.has(atual)) continue
    visto.add(atual)
    const codigo = ler(atual)
    if (atual !== inicio && (/^\s*import\s+['"]server-only['"]/m.test(codigo) || atual.startsWith(path.join(SRC, 'db')))) return cam
    // Ações de servidor ('use server') podem ser chamadas do cliente: o Next troca por uma chamada de rede.
    if (atual !== inicio && diretiva(codigo, 'use server')) continue
    for (const p of importsLocais(atual)) fila.push([...cam, p])
  }
  return null
}

describe('fronteira cliente/servidor', () => {
  const clientes = TODOS.filter((p) => diretiva(ler(p), 'use client'))

  it('existem componentes de cliente para conferir', () => {
    expect(clientes.length).toBeGreaterThan(10)
  })

  it.each(clientes.map((p) => [rel(p), p]))('%s não puxa banco nem código só de servidor', (_, p) => {
    const cam = caminhoAteServidor(p)
    expect(cam?.map(rel) ?? null).toBeNull()
  })

  it('arquivos com segredo ou banco são marcados server-only', () => {
    for (const nome of ['auth.ts', 'dados.ts', 'documentos.ts', 'armazenamento.ts', 'audit.ts', 'acesso.ts', 'obs/log.ts']) {
      expect(ler(path.join(SRC, 'lib', nome)), nome).toMatch(/^\s*import\s+['"]server-only['"]/m)
    }
  })
})

const CHECA_SESSAO = /\b(exigirAdmin|exigirMotorista|adminDaApi|motoristaDaApi)\s*\(/

/** Corpo de cada função exportada (do "export" até o próximo "export" do arquivo). */
function exportadas(codigo: string) {
  const re = /^export\s+(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+))/gm
  const pos = [...codigo.matchAll(re)].map((m) => ({ nome: m[1] ?? m[2], ini: m.index! }))
  return pos.map((p, i) => ({ nome: p.nome, corpo: codigo.slice(p.ini, pos[i + 1]?.ini ?? codigo.length) }))
}

describe('toda porta de entrada confere a sessão', () => {
  // Rotas públicas de propósito, cada uma com o motivo.
  const ROTAS_PUBLICAS: Record<string, string> = {
    'src/app/api/saude/route.ts': 'monitor de disponibilidade; não devolve dados',
    'src/app/acesso/[token]/route.ts': 'o próprio token do link (de uso controlado) é a credencial',
  }
  const ACOES_PUBLICAS: Record<string, string> = {
    'src/app/entrar/actions.ts': 'entrar e sair',
    'src/app/configurar/actions.ts': 'primeiro administrador; só funciona com o banco sem nenhum',
  }

  const rotas = TODOS.filter((p) => /route\.ts$/.test(p))
  it.each(rotas.map((p) => [rel(p), p]))('rota %s', (r, p) => {
    if (ROTAS_PUBLICAS[r]) return
    const metodos = exportadas(ler(p)).filter((f) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(f.nome))
    expect(metodos.length, 'rota sem método exportado').toBeGreaterThan(0)
    for (const m of metodos) expect(m.corpo, `${m.nome} não confere a sessão`).toMatch(CHECA_SESSAO)
  })

  const acoes = TODOS.filter((p) => diretiva(ler(p), 'use server'))
  it.each(acoes.map((p) => [rel(p), p]))('ações em %s', (r, p) => {
    if (ACOES_PUBLICAS[r]) return
    const codigo = ler(p)
    // Ajudantes locais que já conferem a sessão (ex.: gravar() no admin) valem como conferência.
    const ajudantes = [...codigo.matchAll(/^(?:async\s+)?function\s+(\w+)[\s\S]*?^}/gm)].filter((m) => CHECA_SESSAO.test(m[0])).map((m) => m[1])
    const confere = ajudantes.length ? new RegExp(`${CHECA_SESSAO.source}|\\b(${ajudantes.join('|')})\\s*\\(`) : CHECA_SESSAO
    for (const f of exportadas(codigo)) expect(f.corpo, `${f.nome} não confere a sessão`).toMatch(confere)
  })

  it('o primeiro acesso só funciona com o banco sem administradores', () => {
    expect(ler(path.join(SRC, 'app/configurar/actions.ts'))).toMatch(/administradores/)
  })

  it('as exceções existem de verdade (lista não fica velha)', () => {
    for (const r of [...Object.keys(ROTAS_PUBLICAS), ...Object.keys(ACOES_PUBLICAS)]) expect(existsSync(path.join(RAIZ, r)), r).toBe(true)
  })
})
