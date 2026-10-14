CREATE TYPE "public"."pago_por" AS ENUM('empresa', 'motorista');--> statement-breakpoint
CREATE TYPE "public"."status_despesa" AS ENUM('pendente', 'aprovada', 'recusada');--> statement-breakpoint
CREATE TYPE "public"."status_viagem" AS ENUM('andamento', 'encerrada');--> statement-breakpoint
CREATE TABLE "acertos" (
	"id" serial PRIMARY KEY NOT NULL,
	"motorista_id" integer NOT NULL,
	"mes" text NOT NULL,
	"valor" integer NOT NULL,
	"pago_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administradores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"usuario" text NOT NULL,
	"senha_hash" text NOT NULL,
	"versao_sessao" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administradores_usuario_unique" UNIQUE("usuario")
);
--> statement-breakpoint
CREATE TABLE "alertas_dispensados" (
	"chave" text PRIMARY KEY NOT NULL,
	"em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apolices" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"cobertura" text NOT NULL,
	"vigencia_ate" date,
	"custo_mensal" integer NOT NULL,
	"obrigatorio" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"em" timestamp with time zone DEFAULT now() NOT NULL,
	"autor" text NOT NULL,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text,
	"dados" jsonb
);
--> statement-breakpoint
CREATE TABLE "caminhoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"placa" text NOT NULL,
	"placa_carreta" text,
	"descricao" text NOT NULL,
	"ano" integer,
	"km" integer DEFAULT 0 NOT NULL,
	"meta_consumo" numeric(10, 2) DEFAULT 2.4 NOT NULL,
	"proxima_revisao_km" integer,
	"tacografo_ate" date,
	"licenciamento_ate" date,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "caminhoes_placa_unique" UNIQUE("placa")
);
--> statement-breakpoint
CREATE TABLE "configuracao" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"dias_aviso" integer DEFAULT 60 NOT NULL,
	"dias_urgente" integer DEFAULT 20 NOT NULL,
	"km_aviso_revisao" integer DEFAULT 5000 NOT NULL,
	"sulco_minimo" numeric(10, 2) DEFAULT 3 NOT NULL,
	"retorno_pct" integer DEFAULT 60 NOT NULL,
	"nome_empresa" text DEFAULT 'Empresa FG' NOT NULL,
	"whatsapp_escritorio" text
);
--> statement-breakpoint
CREATE TABLE "custos_fixos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"valor_mensal" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "despesas" (
	"id" serial PRIMARY KEY NOT NULL,
	"viagem_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"valor" integer NOT NULL,
	"litros" numeric(10, 2),
	"km_abastecimento" integer,
	"obs" text,
	"data" date NOT NULL,
	"pago_por" "pago_por" DEFAULT 'empresa' NOT NULL,
	"status" "status_despesa" DEFAULT 'pendente' NOT NULL,
	"motivo_recusa" text,
	"foto_id" uuid,
	"client_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "despesas_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "fotos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dados" "bytea" NOT NULL,
	"mime" text NOT NULL,
	"tamanho" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lembretes" (
	"id" serial PRIMARY KEY NOT NULL,
	"texto" text NOT NULL,
	"data" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links_acesso" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"motorista_id" integer NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	CONSTRAINT "links_acesso_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "manutencoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"caminhao_id" integer NOT NULL,
	"data" date NOT NULL,
	"tipo" text NOT NULL,
	"descricao" text NOT NULL,
	"valor" integer NOT NULL,
	"imprevisto" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "motoristas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"pin_hash" text NOT NULL,
	"comissao_pct" numeric(10, 2) DEFAULT 10 NOT NULL,
	"caminhao_id" integer,
	"cnh_ate" date,
	"toxicologico_ate" date,
	"ativo" boolean DEFAULT true NOT NULL,
	"versao_sessao" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "motoristas_telefone_unique" UNIQUE("telefone")
);
--> statement-breakpoint
CREATE TABLE "pneus" (
	"id" serial PRIMARY KEY NOT NULL,
	"caminhao_id" integer NOT NULL,
	"posicao" integer NOT NULL,
	"eixo" text NOT NULL,
	"lado" text NOT NULL,
	"local" text DEFAULT '' NOT NULL,
	"sulco" numeric(10, 2) NOT NULL,
	"recapagens" integer DEFAULT 0 NOT NULL,
	"km" integer DEFAULT 0 NOT NULL,
	"custo" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentativas_login" (
	"chave" text PRIMARY KEY NOT NULL,
	"falhas" integer DEFAULT 0 NOT NULL,
	"bloqueado_ate" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "viagens" (
	"id" serial PRIMARY KEY NOT NULL,
	"motorista_id" integer NOT NULL,
	"caminhao_id" integer NOT NULL,
	"origem" text NOT NULL,
	"destino" text NOT NULL,
	"carga" text NOT NULL,
	"frete" integer NOT NULL,
	"comissao_pct" numeric(10, 2) NOT NULL,
	"adiantamento" integer DEFAULT 0 NOT NULL,
	"inicio" date NOT NULL,
	"fim" date,
	"km_inicial" integer NOT NULL,
	"km_final" integer,
	"km_vazio" integer DEFAULT 0 NOT NULL,
	"status" "status_viagem" DEFAULT 'andamento' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acertos" ADD CONSTRAINT "acertos_motorista_id_motoristas_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."motoristas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_viagem_id_viagens_id_fk" FOREIGN KEY ("viagem_id") REFERENCES "public"."viagens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_foto_id_fotos_id_fk" FOREIGN KEY ("foto_id") REFERENCES "public"."fotos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links_acesso" ADD CONSTRAINT "links_acesso_motorista_id_motoristas_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."motoristas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_caminhao_id_caminhoes_id_fk" FOREIGN KEY ("caminhao_id") REFERENCES "public"."caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motoristas" ADD CONSTRAINT "motoristas_caminhao_id_caminhoes_id_fk" FOREIGN KEY ("caminhao_id") REFERENCES "public"."caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pneus" ADD CONSTRAINT "pneus_caminhao_id_caminhoes_id_fk" FOREIGN KEY ("caminhao_id") REFERENCES "public"."caminhoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagens" ADD CONSTRAINT "viagens_motorista_id_motoristas_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."motoristas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagens" ADD CONSTRAINT "viagens_caminhao_id_caminhoes_id_fk" FOREIGN KEY ("caminhao_id") REFERENCES "public"."caminhoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acerto_mes_motorista" ON "acertos" USING btree ("motorista_id","mes");--> statement-breakpoint
CREATE INDEX "auditoria_em_idx" ON "auditoria" USING btree ("em");--> statement-breakpoint
CREATE INDEX "despesas_viagem_idx" ON "despesas" USING btree ("viagem_id");--> statement-breakpoint
CREATE INDEX "despesas_status_idx" ON "despesas" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pneu_posicao" ON "pneus" USING btree ("caminhao_id","posicao");--> statement-breakpoint
CREATE INDEX "viagens_motorista_idx" ON "viagens" USING btree ("motorista_id");--> statement-breakpoint
CREATE INDEX "viagens_inicio_idx" ON "viagens" USING btree ("inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "viagem_ativa_por_motorista" ON "viagens" USING btree ("motorista_id") WHERE status = 'andamento';