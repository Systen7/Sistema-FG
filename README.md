# Sistema FG

Gestão de viagens, despesas e frota da transportadora. É **um sistema só**, com um único banco de dados e duas entradas:

| Quem | Endereço | O que faz |
| --- | --- | --- |
| **Escritório (administrador)** | `/admin` | Vê e corrige tudo: viagens, cargas, fretes, despesas com foto do comprovante, lucro por viagem, motorista, caminhão e rota, acerto dos motoristas, frota, pneus, seguros, alertas e relatórios em planilha. |
| **Motorista** | `/m` | App simples para celular: inicia a viagem, lança gastos (com foto) e encerra. Vê só as próprias viagens e o extrato de comissão. Tudo cai na hora no painel do escritório. |

## Como o motorista entra (sem complicação)

1. No escritório, em **Motoristas › Acesso**, gere o link e toque em **Enviar pelo WhatsApp**.
2. O motorista toca no link e já entra, sem digitar nada. A primeira tela explica o app e ensina a colocar o ícone na tela inicial.
3. Se um dia precisar entrar de novo, ele usa o **celular + PIN de 4 números**. O celular fica lembrado no aparelho, então basta o PIN.

Pensado para a estrada:

- **Botões grandes** e textos maiores. Valores digitados só com o teclado numérico: `1 2 3 4 5` vira `R$ 123,45`.
- **Funciona sem sinal.** O gasto lançado fica guardado no celular e é enviado sozinho quando a internet volta, sem duplicar. O app abre mesmo offline, mostrando os últimos dados.
- **Foto do comprovante.** É reduzida no próprio celular antes de enviar, para subir rápido mesmo com sinal fraco.
- **Pouca digitação.** Botão para repetir uma rota recente, sugestões de cidades e cargas e km preenchido com o último registrado.
- **Conferência antes de errar.** O app avisa sobre preço por litro fora do normal, km rodado alto demais e km final menor que o inicial.
- **Instalável como aplicativo (PWA)** no Android e no iPhone, sem loja de apps.

## CT-e e MDF-e

O sistema não emite documentos fiscais: eles continuam sendo emitidos no seu emissor, com o seu certificado. O sistema **controla** esses documentos:

- **Importar:** em **CT-e e MDF-e**, ou dentro de uma viagem, solte os XML (o arquivo "proc", com protocolo). Ele lê chave, número, rota, carga, peso, valor e placa.
- **Ligar à viagem:** o MDF-e é ligado sozinho à viagem do caminhão com a mesma placa naquela data e leva junto os CT-e que cita. Também dá para escolher a viagem manualmente ou **criar a viagem a partir do XML**, já preenchida.
- **PDF:** o DACTE/DAMDFE é anexado automaticamente quando a chave está no nome do arquivo, ou pelo botão "+ PDF" na linha do documento.
- **Motorista:** vê no celular o MDF-e e os CT-e da viagem atual, com a chave para mostrar na fiscalização e o PDF.
- **Encerramento:** importe o XML do evento de encerramento (ou clique em "Encerrado"). Um MDF-e aberto com a viagem já terminada, ou aberto há mais de 30 dias, vira **alerta urgente**. O XML do evento de cancelamento marca o documento como cancelado.
- **Conferência:** avisa quando o frete da viagem é diferente da soma dos CT-e (com um botão para corrigir), quando a placa do MDF-e não é a do caminhão da viagem e quando uma viagem encerrada está sem CT-e.
- **Planilha:** em Relatórios, a lista de documentos com chave, situação e viagem.

## Regras de cálculo

Todo cálculo é feito no servidor. Os valores ficam em centavos, sem erro de arredondamento.

- **Lucro da viagem** = frete − despesas (menos as recusadas) − comissão.
- **Comissão** = frete × % do motorista **gravado no início da viagem**. Mudar a comissão depois não altera viagens antigas.
- **Lucro líquido do mês** = lucro das viagens − manutenção − seguros − custos fixos. No mês corrente, seguros e fixos entram proporcionais aos dias corridos.
- **Deixou de ganhar** = km vazio × (frete ÷ km carregado) × % de frete de retorno (ajustável) × % de comissão.
- **Acerto** = comissões + reembolsos (gastos pagos do bolso e aprovados) − adiantamentos.
- **Aprovação:** gasto lançado pelo motorista entra como *pendente*. Se ele corrigir um gasto já aprovado, o gasto volta para aprovação.

## Segurança

- **Senhas e PINs** são guardados com hash (bcrypt).
- **Sessão** em cookie `httpOnly` assinado: 180 dias para o motorista, 30 para o escritório.
- **Bloqueio de tentativas:** 5 erros seguidos travam o login por 15 minutos.
- **Celular perdido:** **Desconectar aparelhos** derruba todas as sessões daquele motorista.
- **Isolamento:** o motorista só acessa as próprias viagens e fotos; as áreas são separadas no servidor.
- **Histórico de alterações:** quem fez o quê, visível em Configurações e em cada viagem.

## Rodar no computador

Requisitos: Node.js 20.9 ou mais novo e PostgreSQL 16.

```bash
cp .env.example .env          # ajuste DATABASE_URL e SESSION_SECRET
npm install
npm run db:migrate            # cria as tabelas
npm run db:seed               # opcional: dados de exemplo (os do protótipo)
npm run dev                   # http://localhost:3000
```

Com os dados de exemplo:

- **Escritório:** usuário `admin`, senha `fg2026`.
- **Motoristas:** celular `(66) 90000-0001` com PIN `1111`. Os outros terminam em `0002`, `0003` e `0004`, com PIN `2222`, `3333` e `4444`.

Para mostrar esses acessos na tela de entrada, rode com `DEMO=1`.

## Colocar no ar (Vercel, grátis)

O projeto já está preparado para a Vercel (`vercel.json`): a cada envio ao GitHub ela atualiza o banco e publica sozinha, na região de São Paulo.

1. Na Vercel, importe o repositório `Sistema-FG`.
2. Na aba **Storage** do projeto, crie um banco **Neon** (Postgres) e ligue ao projeto. As variáveis `DATABASE_URL` e `DATABASE_URL_UNPOOLED` são preenchidas sozinhas.
3. Ainda em **Storage**, crie um **Blob** privado para as fotos dos comprovantes (variável `BLOB_READ_WRITE_TOKEN`).
4. Em **Settings › Environment Variables**, defina `SESSION_SECRET` (texto aleatório longo) e `TZ_EMPRESA=America/Sao_Paulo`.
5. Publique de novo (**Redeploy**) e abra o endereço: na primeira vez aparece a tela **Primeiro acesso**, onde você cria seu usuário de administrador.

Sem o Blob, as fotos ficam no próprio banco; funciona, mas ocupa o espaço do plano grátis mais rápido.

## Colocar no ar (outras opções)

O sistema precisa de **HTTPS** para a câmera, a instalação no celular e o funcionamento offline.

**Opção 1: servidor próprio (VPS) com Docker**

```bash
cp .env.example .env   # defina SESSION_SECRET, APP_URL=https://seu-dominio e DB_SENHA
docker compose up -d --build
docker compose exec app npm run db:admin -- seu.usuario "Seu Nome" "uma-senha-forte"
```

Coloque um proxy com HTTPS na frente (Caddy, Nginx ou Cloudflare).

**Opção 2: hospedagem gerenciada.** Serve qualquer serviço que rode Node.js e ofereça PostgreSQL, como Railway, Render, Fly.io ou Vercel com Neon/Supabase.

1. Configure `DATABASE_URL`, `SESSION_SECRET`, `APP_URL` e `TZ_EMPRESA`.
2. Defina o comando de build como `npm run build` e o de início como `npm run db:migrate && npm start`.
3. Abra o endereço e crie o primeiro acesso do escritório na tela **Primeiro acesso** (ou rode `npm run db:admin -- usuario "Nome" senha`).

As fotos dos comprovantes ficam no próprio banco (reduzidas para cerca de 150 KB cada), então não há outro serviço para configurar. **Faça cópia de segurança do banco** (`pg_dump`) com frequência.

## Comandos

| Comando | Para quê |
| --- | --- |
| `npm run dev` | Desenvolvimento |
| `npm run build` / `npm start` | Produção |
| `npm run db:generate` | Gera migração depois de mudar `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrações |
| `npm run db:seed -- --limpar` | Apaga tudo e recria os exemplos |
| `npm run db:admin -- usuario "Nome" senha` | Cria acesso do escritório ou redefine a senha |
| `npm test` | Testes das regras de cálculo |
| `npm run e2e` | Teste completo no navegador: motorista + escritório, inclusive sem sinal |

## Estrutura

```
src/
  app/
    entrar/        tela de entrada (motorista: celular + PIN; escritório: usuário + senha)
    acesso/[token] link de acesso enviado pelo WhatsApp
    m/             app do motorista
    admin/         área do escritório
    api/           envio de gastos do motorista, fotos e exportação de planilhas
  db/schema.ts     tabelas do banco
  lib/calc.ts      regras de cálculo (funções puras, com testes)
  lib/alertas.ts   vencimentos e avisos
  lib/cliente/     fila offline e redução de foto (roda no celular)
public/sw.js       service worker (abrir sem sinal)
```

## Próximas etapas

- **Rastreamento real:** integração com a API do rastreador dos caminhões.
- **WhatsApp:** número oficial da empresa (WhatsApp Business API) e avisos automáticos.
- **Fiscal e pagamentos:** emissão de CT-e/MDF-e pelo próprio sistema (hoje só controla), CIOT, vale-pedágio, cartão combustível e tag de pedágio.
- **Financeiro:** clientes, contas a receber, contas a pagar e fluxo de caixa.
- **Notificações push** para o escritório quando chega gasto para aprovar.
