<!-- Título do PR: tipo(escopo): descrição — ex.: "fix(motorista): corrigir data do gasto". Ver AGENTS.md, seção 3. -->

## Issue
<!-- Obrigatório. Use "Fixes #N" para correção e "Closes #N" para os demais, para a Issue fechar no merge. -->
Closes #

## O que mudou
<!-- Em português, do ponto de vista de quem usa o sistema. -->
- 

## Como testar
<!-- Passos para conferir na prévia da Vercel (link aparece neste PR). -->
1. 

## Verificação
- [ ] `npm run check` (tipos, Biome, arquitetura, Knip e testes de unidade) passa
- [ ] `npm run test:integracao` passa; código novo veio com teste
- [ ] `npm run build` passa
- [ ] Testes de navegador (`npm run e2e`) passam, ou o motivo de não rodar está explicado
- [ ] Mudou o banco? Migração incluída em `drizzle/` e compatível com os dados de produção
- [ ] Conferido na prévia da Vercel

<!-- Merge: só o dono do projeto, depois de olhar a prévia (AGENTS.md). -->
