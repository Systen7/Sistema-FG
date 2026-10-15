# Instruções para agentes (qualquer modelo) e pessoas

Este arquivo vale para **todo agente de IA** (Claude, GPT, Gemini, Copilot, Cursor etc.) e para qualquer pessoa que mexa neste repositório. Leia inteiro antes de começar. O `CLAUDE.md` aponta para cá.

Repositório: `Systen7/Sistema-FG`. Produção: https://sistema-fg.vercel.app (Vercel, publica sozinha a cada mudança na `main`).

## 1. Fluxo obrigatório: Issue → branch → Pull Request → merge

**Nenhuma mudança vai direto para a `main`.** Toda tarefa, por menor que seja, segue estes passos:

1. **Issue primeiro.** Antes de escrever código, abra uma Issue no GitHub (ou use a que já existe) com **uma** destas etiquetas:
   | Etiqueta | Quando usar |
   | --- | --- |
   | `correção` | Algo não funciona como deveria (erro, cálculo errado, tela quebrada). |
   | `melhoria` | Algo que já existe fica melhor (mais rápido, mais claro, mais fácil). |
   | `nova função` | Funcionalidade que ainda não existe. |
   | `processo` | Organização do projeto, documentação, testes, fluxo de trabalho. |

   Use os modelos em `.github/ISSUE_TEMPLATE/`. Escreva em português: **Contexto** (o problema ou a necessidade), **O que fazer** e **Critérios de aceite** (lista de verificação).
   Se o pedido tiver várias tarefas independentes, abra **uma Issue para cada**.

2. **Branch a partir da `main` atualizada**, com o nome `<tipo>/<número-da-issue>-<descricao-curta>`:
   - `correcao/12-km-final-negativo`
   - `melhoria/15-filtro-por-caminhao`
   - `nova-funcao/4-emissao-cte`
   - `processo/1-fluxo-issues-prs`

3. **Commits** em português, no imperativo e descrevendo o efeito ("Corrigir data do gasto lançado sem sinal"). Pode citar a Issue no corpo (`Ref #12`).

4. **Pull Request para a `main`**, usando o modelo `.github/pull_request_template.md`. **A descrição do PR precisa mencionar a Issue** com uma palavra de fechamento, para ela fechar sozinha no merge:
   - `Closes #12` (nova função, melhoria, processo) ou `Fixes #12` (correção).
   - Um PR resolve uma Issue. Se tocar em outra sem resolvê-la, use `Ref #N`.

5. **Verificação automática** (GitHub Actions, `.github/workflows/verificacao.yml`) roda em todo PR: tipos, testes de unidade, compilação de produção e testes de navegador com banco. **Só faça merge com tudo verde.**

6. **Prévia na Vercel:** todo PR ganha uma publicação de prévia com endereço próprio (aparece no PR). A prévia usa o **mesmo banco de produção**: não apague nem invente dados lá.

7. **Quem faz o merge é o dono do projeto, nunca o agente.** O merge na `main` publica em produção. O agente:
   - abre o PR, espera as verificações ficarem verdes e corrige o que falhar;
   - avisa o dono com o link do PR, o link da prévia e o que conferir nela;
   - **para aí.** Não faz merge, não envia direto para a `main` e não pede para "liberar" a proteção.

   O dono confere a prévia e clica em **Squash and merge** no GitHub. A branch é apagada depois do merge.

8. **Depois do merge** (se o dono pedir), o agente confere se a publicação ficou **Ready** na Vercel e se a Issue foi fechada.

A `main` deve ficar protegida no GitHub (*Settings › Branches*, configurado pelo dono): só aceita mudanças por Pull Request com as duas verificações aprovadas (`Tipos, testes e compilação` e `Testes de navegador`). Mesmo sem a proteção ligada, a regra vale: agente nenhum envia direto para a `main`.

Se não for possível abrir Issue ou PR (sem acesso ao GitHub), **não envie para a `main`**: deixe o trabalho numa branch e avise quem pediu.

## 2. Antes de abrir o PR, rode localmente

```bash
npm run check        # tipos + testes de unidade
npm run build        # compilação de produção
npm run e2e          # testes de navegador (precisa de PostgreSQL e do servidor rodando, ver README)
```

Mudou o banco (`src/db/schema.ts`)? Gere a migração com `npm run db:generate` e inclua a pasta `drizzle/` no PR. Migrações precisam ser **compatíveis com os dados que já existem** em produção (nada de apagar coluna com dados sem um plano de migração na Issue).

## 3. Regras do projeto

- **Idioma:** interface, mensagens, Issues, PRs e commits em **português do Brasil**. Nomes no código também em português, seguindo o que já existe.
- **Dinheiro em centavos** (inteiro) no banco e nos cálculos; formatar só na tela (`src/lib/format.ts`).
- **Datas** como texto `AAAA-MM-DD` no fuso `America/Sao_Paulo` (`src/lib/datas.ts`). Nunca use `toISOString().slice(0, 10)` para "hoje": dá o dia errado à noite.
- **Regras de cálculo** ficam em funções puras com teste (`src/lib/calc.ts`, `src/lib/alertas.ts`, `src/lib/fiscal.ts`). Mudou uma regra? Atualize ou crie o teste em `tests/`.
- **Segurança:** o motorista só pode ver e alterar o que é dele; toda rota de API e ação confere a sessão (`exigirAdmin`, `exigirMotorista`, `motoristaDaApi`, `adminDaApi`). Nunca coloque segredos (senhas, chaves, `.env`, certificados) no repositório.
- **App do motorista:** pensado para celular, sinal ruim e pouca digitação. Botões grandes, teclado numérico, funciona sem sinal (fila em `src/lib/cliente/fila.ts`). Não quebre isso.
- **Fotos e PDFs** vão para o Vercel Blob (privado) via `src/lib/armazenamento.ts`; ao apagar registros, apague os arquivos junto (`apagarArquivos`).
- **Visual:** reutilize as classes de `src/app/globals.css` (tema escuro preto e azul) em vez de criar estilos soltos.
- **Next.js 16:** veja o bloco abaixo; `params`, `searchParams` e `cookies()` são assíncronos e o middleware se chama `proxy.ts`.

## 4. Estrutura rápida

| Caminho | O que é |
| --- | --- |
| `src/app/admin/` | Área do escritório |
| `src/app/m/` | App do motorista (PWA) |
| `src/app/api/` | Rotas de API (gastos do motorista, fotos, documentos, planilhas) |
| `src/db/schema.ts` | Tabelas do banco (Drizzle ORM + PostgreSQL/Neon) |
| `src/lib/` | Regras, cálculos, autenticação, leitura de XML fiscal |
| `tests/` · `e2e/` | Testes de unidade (Vitest) · testes de navegador (Playwright) |
| `drizzle/` | Migrações do banco (aplicadas no build da Vercel) |

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
